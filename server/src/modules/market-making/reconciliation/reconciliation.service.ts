import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import type { Queue } from 'bull';
import { BalanceReadModel } from 'src/common/entities/ledger/balance-read-model.entity';
import { RewardAllocation } from 'src/common/entities/ledger/reward-allocation.entity';
import { RewardLedger } from 'src/common/entities/ledger/reward-ledger.entity';
import { StrategyOrderIntentEntity } from 'src/common/entities/market-making/strategy-order-intent.entity';
import { MarketMakingOrder } from 'src/common/entities/orders/user-orders.entity';
import type { MarketMakingStates } from 'src/common/types/orders/states';
import { GrowdataRepository } from 'src/modules/data/grow-data/grow-data.repository';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';
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
    @InjectQueue('market-making') private readonly marketMakingQueue: Queue,
    private readonly growdataRepository: GrowdataRepository,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runPeriodicReconciliation(): Promise<void> {
    const ledger = await this.reconcileLedgerInvariants();
    const rewards = await this.reconcileRewardConsistency();
    const intents = await this.reconcileIntentLifecycleConsistency();
    const depositConfirming = await this.reconcileDepositConfirmingOrders();

    this.logger.log(
      `Ledger reconciliation checked=${ledger.checked} violations=${ledger.violations}; reward checked=${rewards.checked} violations=${rewards.violations}; intent checked=${intents.checked} violations=${intents.violations}; deposit_confirming checked=${depositConfirming.checked} repaired=${depositConfirming.repaired}`,
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
}
