import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import type { Queue } from 'bull';
import { BalanceReadModel } from 'src/common/entities/ledger/balance-read-model.entity';
import { RewardAllocation } from 'src/common/entities/ledger/reward-allocation.entity';
import { RewardLedger } from 'src/common/entities/ledger/reward-ledger.entity';
import { MMExchangeAllocation } from 'src/common/entities/market-making/mm-exchange-allocation.entity';
import { StrategyOrderIntentEntity } from 'src/common/entities/market-making/strategy-order-intent.entity';
import { MarketMakingOrder } from 'src/common/entities/orders/user-orders.entity';
import type { MarketMakingStates } from 'src/common/types/orders/states';
import { GrowdataRepository } from 'src/modules/data/grow-data/grow-data.repository';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';
import { DurabilityService } from '../durability/durability.service';
import { Repository } from 'typeorm';

import { ExchangeOrderTrackerService } from '../trackers/exchange-order-tracker.service';

type ReconciliationReport = {
  checked: number;
  violations: number;
};

type DepositConfirmingRepairReport = {
  checked: number;
  repaired: number;
};

type ExitInProgressRepairReport = {
  checked: number;
  repaired: number;
};

@Injectable()
export class ReconciliationService {
  private readonly logger = new CustomLogger(ReconciliationService.name);

  constructor(
    @InjectRepository(BalanceReadModel)
    private readonly balanceReadModelRepository: Repository<BalanceReadModel>,
    private readonly exchangeOrderTrackerService: ExchangeOrderTrackerService,
    @InjectRepository(RewardLedger)
    private readonly rewardLedgerRepository: Repository<RewardLedger>,
    @InjectRepository(RewardAllocation)
    private readonly rewardAllocationRepository: Repository<RewardAllocation>,
    @InjectRepository(StrategyOrderIntentEntity)
    private readonly strategyOrderIntentRepository: Repository<StrategyOrderIntentEntity>,
    @InjectRepository(MarketMakingOrder)
    private readonly marketMakingOrderRepository: Repository<MarketMakingOrder>,
    @InjectRepository(MMExchangeAllocation)
    private readonly mmExchangeAllocationRepository: Repository<MMExchangeAllocation>,
    @InjectQueue('market-making') private readonly marketMakingQueue: Queue,
    private readonly growdataRepository: GrowdataRepository,
    private readonly durabilityService: DurabilityService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runPeriodicReconciliation(): Promise<void> {
    const ledger = await this.reconcileLedgerInvariants();
    const rewards = await this.reconcileRewardConsistency();
    const intents = await this.reconcileIntentLifecycleConsistency();
    const depositConfirming = await this.reconcileDepositConfirmingOrders();
    const exitInProgress = await this.reconcileExitInProgressOrders();
    const allocations = await this.reconcileAllocationInvariants();

    this.logger.log(
      `Ledger reconciliation checked=${ledger.checked} violations=${ledger.violations}; reward checked=${rewards.checked} violations=${rewards.violations}; intent checked=${intents.checked} violations=${intents.violations}; deposit_confirming checked=${depositConfirming.checked} repaired=${depositConfirming.repaired}; exit_in_progress checked=${exitInProgress.checked} repaired=${exitInProgress.repaired}; allocations checked=${allocations.checked} violations=${allocations.violations}`,
    );
  }

  async reconcileLedgerInvariants(): Promise<ReconciliationReport> {
    const rows = await this.balanceReadModelRepository.find();
    let violations = 0;

    for (const row of rows) {
      const available = new BigNumber(row.available);
      const locked = new BigNumber(row.locked);
      const total = new BigNumber(row.total);

      if (!available.plus(locked).isEqualTo(total)) {
        violations += 1;
      }

      if (available.isLessThan(0) || locked.isLessThan(0)) {
        violations += 1;
      }
    }

    return {
      checked: rows.length,
      violations,
    };
  }

  getOpenOrdersForStrategy(strategyKey: string) {
    return this.exchangeOrderTrackerService.getOpenOrders(strategyKey);
  }

  async reconcileRewardConsistency(): Promise<ReconciliationReport> {
    const rewards = await this.rewardLedgerRepository.find();
    const allocations = await this.rewardAllocationRepository.find();

    let violations = 0;

    for (const reward of rewards) {
      const rewardAmount = new BigNumber(reward.amount);
      const allocated = allocations
        .filter((allocation) => allocation.rewardTxHash === reward.txHash)
        .reduce(
          (acc, allocation) => acc.plus(allocation.amount),
          new BigNumber(0),
        );

      if (allocated.isGreaterThan(rewardAmount)) {
        violations += 1;
      }
    }

    return {
      checked: rewards.length,
      violations,
    };
  }

  async reconcileIntentLifecycleConsistency(): Promise<ReconciliationReport> {
    const intents = await this.strategyOrderIntentRepository.find();
    let violations = 0;
    const now = Date.now();

    for (const intent of intents) {
      if (
        intent.type === 'CREATE_LIMIT_ORDER' &&
        intent.status === 'DONE' &&
        !intent.mixinOrderId
      ) {
        violations += 1;
      }

      if (intent.status === 'SENT') {
        const ageMs = now - Date.parse(intent.updatedAt || intent.createdAt);

        if (Number.isFinite(ageMs) && ageMs > 5 * 60 * 1000) {
          violations += 1;
        }
      }
    }

    return {
      checked: intents.length,
      violations,
    };
  }

  /**
   * Repair worker for a known failure mode:
   * - order is stuck in `deposit_confirming` (exchange deposits already happened)
   * - `monitor_exchange_deposit` job was missed/lost (queue outage/restart)
   *
   * This periodically re-enqueues the monitor job (idempotent by jobId).
   */
  async reconcileDepositConfirmingOrders(): Promise<DepositConfirmingRepairReport> {
    const statesToRepair: MarketMakingStates[] = ['deposit_confirming'];

    const orders = await this.marketMakingOrderRepository.findBy({
      state: statesToRepair[0],
    });

    let repaired = 0;

    for (const order of orders) {
      try {
        const pairConfig =
          await this.growdataRepository.findMarketMakingPairByExchangeAndSymbol(
            order.exchangeName,
            order.pair,
          );

        if (!pairConfig) {
          this.logger.warn(
            `Reconciliation: deposit_confirming order ${order.orderId} missing pair config (${order.exchangeName} ${order.pair})`,
          );
          continue;
        }

        await this.marketMakingQueue.add(
          'monitor_exchange_deposit',
          {
            orderId: order.orderId,
            marketMakingPairId: pairConfig.id,
            traceId: `mm:reconcile:${order.orderId}`,
            // using order.createdAt makes matching less fragile across restarts
            startedAt: Date.parse(order.createdAt) || Date.now(),
          },
          {
            jobId: `monitor_exchange_deposit_${order.orderId}`,
            attempts: 120,
            backoff: { type: 'fixed', delay: 30000 },
            removeOnComplete: false,
          },
        );

        repaired += 1;
      } catch (error) {
        this.logger.error(
          `Reconciliation: failed to re-enqueue monitor_exchange_deposit for order ${order.orderId}: ${error.message}`,
          error.stack,
        );
      }
    }

    return {
      checked: orders.length,
      repaired,
    };
  }

  /**
   * Repair worker for a known failure mode:
   * - order is stuck in `exit_withdrawing` or `exit_refunding`
   * - `monitor_exit_mixin_deposit` job was missed/lost (queue outage/restart)
   *
   * This periodically re-enqueues the monitor job (idempotent by jobId).
   */
  async reconcileExitInProgressOrders(): Promise<ExitInProgressRepairReport> {
    const statesToRepair: MarketMakingStates[] = ['exit_withdrawing', 'exit_refunding'];

    const orders = await this.marketMakingOrderRepository.findBy({
      state: statesToRepair[0] as any,
    });

    const refunding = await this.marketMakingOrderRepository.findBy({
      state: statesToRepair[1] as any,
    });

    orders.push(...refunding);

    let repaired = 0;

    for (const order of orders) {
      try {
        const allocation = await this.mmExchangeAllocationRepository.findOneBy({
          orderId: order.orderId,
        });

        if (!allocation) {
          this.logger.warn(
            `Reconciliation: exit_in_progress order ${order.orderId} missing mm_exchange_allocation`,
          );
          continue;
        }

        const pairConfig =
          await this.growdataRepository.findMarketMakingPairByExchangeAndSymbol(
            order.exchangeName,
            order.pair,
          );

        if (!pairConfig) {
          this.logger.warn(
            `Reconciliation: exit_in_progress order ${order.orderId} missing pair config (${order.exchangeName} ${order.pair})`,
          );
          continue;
        }

        const persistedStartedAt = allocation.exitWithdrawalStartedAt
          ? Date.parse(allocation.exitWithdrawalStartedAt)
          : Date.parse((order as any).updatedAt || order.createdAt) || Date.now();

        await this.marketMakingQueue.add(
          'monitor_exit_mixin_deposit',
          {
            userId: order.userId,
            orderId: order.orderId,
            exchangeName: pairConfig.exchange_id,
            baseAssetId: pairConfig.base_asset_id,
            quoteAssetId: pairConfig.quote_asset_id,
            expectedBaseAmount: allocation.baseAllocatedAmount,
            expectedQuoteAmount: allocation.quoteAllocatedAmount,
            expectedBaseTxHash: allocation.exitExpectedBaseTxHash,
            expectedQuoteTxHash: allocation.exitExpectedQuoteTxHash,
            traceId: `mm:reconcile:exit:${order.orderId}`,
            startedAt: Number.isFinite(persistedStartedAt)
              ? persistedStartedAt
              : Date.now(),
          },
          {
            jobId: `monitor_exit_mixin_deposit_${order.orderId}`,
            attempts: 120,
            backoff: { type: 'fixed', delay: 30000 },
            removeOnComplete: false,
          },
        );

        repaired += 1;
      } catch (error) {
        this.logger.error(
          `Reconciliation: failed to re-enqueue monitor_exit_mixin_deposit for order ${order.orderId}: ${error.message}`,
          error.stack,
        );
      }
    }

    return {
      checked: orders.length,
      repaired,
    };
  }

  /**
   * Allocation invariants (alert-only; do NOT auto-correct).
   *
   * Goal: detect unsafe states early and emit durable facts for ops/debugging.
   */
  async reconcileAllocationInvariants(): Promise<ReconciliationReport> {
    // Only check states where allocation is expected to exist.
    const statesToCheck: MarketMakingStates[] = [
      'deposit_confirmed',
      'running',
      'paused',
      'stopped',
      'joining_campaign',
      'campaign_joined',
      'exit_requested',
      'exit_withdrawing',
      'exit_refunding',
      'exit_complete',
    ];

    const allOrders: MarketMakingOrder[] = [];

    for (const state of statesToCheck) {
      const rows = await this.marketMakingOrderRepository.findBy({
        state: state as any,
      });

      allOrders.push(...(rows || []));
    }

    // De-dup by orderId
    const ordersById = new Map<string, MarketMakingOrder>();
    for (const o of allOrders) {
      if (o?.orderId && !ordersById.has(o.orderId)) {
        ordersById.set(o.orderId, o);
      }
    }

    let violations = 0;

    for (const order of ordersById.values()) {
      try {
        const allocation = await this.mmExchangeAllocationRepository.findOneBy({
          orderId: order.orderId,
        });

        if (!allocation) {
          violations += 1;
          await this.durabilityService.appendOutboxEvent({
            topic: 'mm.allocation.missing',
            aggregateType: 'market_making_order',
            aggregateId: order.orderId,
            traceId: `mm:reconcile:alloc:${order.orderId}`,
            orderId: order.orderId,
            payload: {
              orderId: order.orderId,
              userId: (order as any).userId || '',
              exchange: order.exchangeName,
              pair: order.pair,
              state: order.state,
              traceId: `mm:reconcile:alloc:${order.orderId}`,
            },
          });
          continue;
        }

        const base = new BigNumber(allocation.baseAllocatedAmount || '0');
        const quote = new BigNumber(allocation.quoteAllocatedAmount || '0');

        const badNumber =
          !base.isFinite() || !quote.isFinite() || base.isLessThan(0) || quote.isLessThan(0);

        if (badNumber) {
          violations += 1;
          await this.durabilityService.appendOutboxEvent({
            topic: 'mm.allocation.invalid_amount',
            aggregateType: 'market_making_order',
            aggregateId: order.orderId,
            traceId: `mm:reconcile:alloc:${order.orderId}`,
            orderId: order.orderId,
            payload: {
              orderId: order.orderId,
              userId: allocation.userId,
              exchange: allocation.exchange,
              baseAllocatedAmount: allocation.baseAllocatedAmount,
              quoteAllocatedAmount: allocation.quoteAllocatedAmount,
              state: allocation.state,
              orderState: order.state,
              traceId: `mm:reconcile:alloc:${order.orderId}`,
            },
          });
        }

        // Exit markers should exist once allocation is in exit_withdrawing
        if (allocation.state === 'exit_withdrawing') {
          const hasMarker = Boolean(allocation.exitWithdrawalStartedAt);

          if (!hasMarker) {
            violations += 1;
            await this.durabilityService.appendOutboxEvent({
              topic: 'mm.allocation.exit_marker_missing',
              aggregateType: 'market_making_order',
              aggregateId: order.orderId,
              traceId: `mm:reconcile:alloc:${order.orderId}`,
              orderId: order.orderId,
              payload: {
                orderId: order.orderId,
                userId: allocation.userId,
                exchange: allocation.exchange,
                allocationState: allocation.state,
                exitWithdrawalStartedAt: allocation.exitWithdrawalStartedAt || '',
                exitExpectedBaseTxHash: allocation.exitExpectedBaseTxHash || '',
                exitExpectedQuoteTxHash: allocation.exitExpectedQuoteTxHash || '',
                traceId: `mm:reconcile:alloc:${order.orderId}`,
              },
            });
          }

          // Partial-failure idempotency markers: if allocation is exit_withdrawing and amounts > 0,
          // both sides should eventually be issued. If not, alert early.
          const needsBase = base.isGreaterThan(0);
          const needsQuote = quote.isGreaterThan(0);
          const baseIssued = Boolean((allocation as any).exitBaseIssuedAt);
          const quoteIssued = Boolean((allocation as any).exitQuoteIssuedAt);

          const baseReady = !needsBase || baseIssued;
          const quoteReady = !needsQuote || quoteIssued;

          if (!baseReady || !quoteReady) {
            violations += 1;
            await this.durabilityService.appendOutboxEvent({
              topic: 'mm.allocation.exit_issued_missing',
              aggregateType: 'market_making_order',
              aggregateId: order.orderId,
              traceId: `mm:reconcile:alloc:${order.orderId}`,
              orderId: order.orderId,
              payload: {
                orderId: order.orderId,
                userId: allocation.userId,
                exchange: allocation.exchange,
                allocationState: allocation.state,
                orderState: order.state,
                baseAllocatedAmount: allocation.baseAllocatedAmount,
                quoteAllocatedAmount: allocation.quoteAllocatedAmount,
                exitWithdrawalStartedAt: allocation.exitWithdrawalStartedAt || '',
                exitBaseIssuedAt: (allocation as any).exitBaseIssuedAt || '',
                exitQuoteIssuedAt: (allocation as any).exitQuoteIssuedAt || '',
                exitExpectedBaseTxHash: allocation.exitExpectedBaseTxHash || '',
                exitExpectedQuoteTxHash: allocation.exitExpectedQuoteTxHash || '',
                traceId: `mm:reconcile:alloc:${order.orderId}`,
              },
            });
          }
        }
      } catch (error) {
        violations += 1;
        this.logger.error(
          `Reconciliation: allocation invariant check failed for order ${order.orderId}: ${error.message}`,
          error.stack,
        );
      }
    }

    return {
      checked: ordersById.size,
      violations,
    };
  }
}

