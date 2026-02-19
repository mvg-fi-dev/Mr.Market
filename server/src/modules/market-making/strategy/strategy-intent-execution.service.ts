import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import BigNumber from 'bignumber.js';
import { getRFC3339Timestamp } from 'src/common/helpers/utils';
import { ExchangeInitService } from 'src/modules/infrastructure/exchange-init/exchange-init.service';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';

import { DurabilityService } from '../durability/durability.service';
import { ExchangeConnectorAdapterService } from '../execution/exchange-connector-adapter.service';
import { ExchangeOrderTrackerService } from '../trackers/exchange-order-tracker.service';
import { classifyCcxtError } from '../trade/trade-error-taxonomy';
import { TradeService } from '../trade/trade.service';
import { StrategyOrderIntent } from './strategy-intent.types';
import { StrategyIntentStoreService } from './strategy-intent-store.service';

@Injectable()
export class StrategyIntentExecutionService {
  private readonly logger = new CustomLogger(
    StrategyIntentExecutionService.name,
  );
  private readonly processedIntentIds = new Set<string>();
  private readonly executeIntents: boolean;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxOpenOrdersPerStrategy: number;

  constructor(
    private readonly tradeService: TradeService,
    private readonly exchangeInitService: ExchangeInitService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly durabilityService?: DurabilityService,
    @Optional()
    private readonly strategyIntentStoreService?: StrategyIntentStoreService,
    @Optional()
    private readonly exchangeConnectorAdapterService?: ExchangeConnectorAdapterService,
    @Optional()
    private readonly exchangeOrderTrackerService?: ExchangeOrderTrackerService,
  ) {
    const killSwitchEnabled = Boolean(
      this.configService.get('strategy.kill_switch_enabled', false),
    );

    this.executeIntents =
      Boolean(this.configService.get('strategy.execute_intents', false)) &&
      !killSwitchEnabled;
    this.maxRetries = Number(
      this.configService.get('strategy.intent_max_retries', 2),
    );
    this.retryBaseDelayMs = Number(
      this.configService.get('strategy.intent_retry_base_delay_ms', 250),
    );
    this.maxOpenOrdersPerStrategy = Math.max(
      1,
      Number(this.configService.get('strategy.max_open_orders_per_strategy', 50)),
    );
  }

  async consumeIntents(intents: StrategyOrderIntent[]): Promise<void> {
    for (const intent of intents) {
      await this.consumeIntent(intent);
    }
  }

  hasProcessedIntent(intentId: string): boolean {
    return this.processedIntentIds.has(intentId);
  }

  private async consumeIntent(intent: StrategyOrderIntent): Promise<void> {
    if (this.processedIntentIds.has(intent.intentId)) {
      return;
    }

    if (intent.type === 'CREATE_LIMIT_ORDER') {
      const openCount =
        this.exchangeOrderTrackerService?.countOpen(intent.strategyKey) ?? 0;

      if (openCount >= this.maxOpenOrdersPerStrategy) {
        this.logger.warn(
          `Skipping CREATE_LIMIT_ORDER due to max_open_orders_per_strategy limit (open=${openCount}, limit=${this.maxOpenOrdersPerStrategy}, strategyKey=${intent.strategyKey})`,
        );

        await this.strategyIntentStoreService?.updateIntentStatus(
          intent.intentId,
          'DONE',
        );
        await this.durabilityService?.appendOutboxEvent({
          topic: 'strategy.intent.skipped',
          aggregateType: 'strategy_intent',
          aggregateId: intent.intentId,
          // For market-making, clientId === orderId.
          orderId: intent.clientId,
          payload: {
            ...intent,
            orderId: intent.clientId,
            eventType: 'EXECUTION_EVENT',
            eventStatus: 'SKIPPED',
            skipReason: 'MAX_OPEN_ORDERS_REACHED',
            openOrders: openCount,
            limit: this.maxOpenOrdersPerStrategy,
          },
        });
        await this.durabilityService?.markProcessed(
          'strategy-intent-execution',
          intent.intentId,
        );
        this.processedIntentIds.add(intent.intentId);

        return;
      }
    }

    const alreadyProcessed = this.durabilityService
      ? await this.durabilityService.isProcessed(
          'strategy-intent-execution',
          intent.intentId,
        )
      : false;

    if (alreadyProcessed) {
      this.processedIntentIds.add(intent.intentId);

      return;
    }

    await this.strategyIntentStoreService?.updateIntentStatus(
      intent.intentId,
      'SENT',
    );

    if (!this.executeIntents) {
      this.processedIntentIds.add(intent.intentId);
      await this.strategyIntentStoreService?.updateIntentStatus(
        intent.intentId,
        'DONE',
      );
      await this.durabilityService?.appendOutboxEvent({
        topic: 'strategy.intent.skipped',
        aggregateType: 'strategy_intent',
        aggregateId: intent.intentId,
        orderId: intent.clientId,
        payload: { ...intent, orderId: intent.clientId },
      });
      await this.durabilityService?.markProcessed(
        'strategy-intent-execution',
        intent.intentId,
      );

      return;
    }

    let executedMixinOrderId: string | undefined;

    try {
      if (intent.type === 'CREATE_LIMIT_ORDER') {
        const result = await this.runWithRetries(() =>
          this.exchangeConnectorAdapterService
            ? this.exchangeConnectorAdapterService.placeLimitOrder(
                intent.exchange,
                intent.pair,
                intent.side,
                intent.qty,
                intent.price,
              )
            : this.tradeService.executeLimitTrade({
                userId: intent.userId,
                clientId: intent.clientId,
                traceId: intent.traceId,
                exchange: intent.exchange,
                symbol: intent.pair,
                side: intent.side,
                amount: new BigNumber(intent.qty).toNumber(),
                price: new BigNumber(intent.price).toNumber(),
              }),
        );

        if (result?.id) {
          executedMixinOrderId = String(result.id);

          await this.strategyIntentStoreService?.attachMixinOrderId(
            intent.intentId,
            executedMixinOrderId,
          );
          this.exchangeOrderTrackerService?.upsertOrder({
            orderId: intent.clientId,
            strategyKey: intent.strategyKey,
            traceId: intent.traceId,
            exchange: intent.exchange,
            pair: intent.pair,
            exchangeOrderId: executedMixinOrderId,
            side: intent.side,
            price: intent.price,
            qty: intent.qty,
            status: 'open',
            updatedAt: getRFC3339Timestamp(),
          });
        }
      }

      if (intent.type === 'CANCEL_ORDER' && intent.mixinOrderId) {
        executedMixinOrderId = intent.mixinOrderId;

        const result = await this.runWithRetries(() =>
          this.exchangeConnectorAdapterService
            ? this.exchangeConnectorAdapterService.cancelOrder(
                intent.exchange,
                intent.pair,
                intent.mixinOrderId as string,
              )
            : (() => {
                const exchange = this.exchangeInitService.getExchange(
                  intent.exchange,
                );

                return exchange.cancelOrder(intent.mixinOrderId, intent.pair);
              })(),
        );

        this.exchangeOrderTrackerService?.upsertOrder({
          orderId: intent.clientId,
          strategyKey: intent.strategyKey,
          traceId: intent.traceId,
          exchange: intent.exchange,
          pair: intent.pair,
          exchangeOrderId: intent.mixinOrderId,
          side: intent.side,
          price: intent.price,
          qty: intent.qty,
          status:
            result?.status === 'canceled' || result?.status === 'cancelled'
              ? 'cancelled'
              : 'failed',
          updatedAt: getRFC3339Timestamp(),
        });
      }

      if (intent.type === 'STOP_EXECUTOR') {
        this.logger.log(`Received STOP_EXECUTOR for ${intent.strategyKey}`);
      }

      await this.strategyIntentStoreService?.updateIntentStatus(
        intent.intentId,
        'ACKED',
      );
      await this.strategyIntentStoreService?.updateIntentStatus(
        intent.intentId,
        'DONE',
      );

      await this.durabilityService?.appendOutboxEvent({
        topic: 'strategy.intent.executed',
        aggregateType: 'strategy_intent',
        aggregateId: intent.intentId,
        orderId: intent.clientId,
        payload: {
          ...intent,
          orderId: intent.clientId,
          eventType: 'EXECUTION_EVENT',
          eventStatus: 'DONE',
          // CCXT exchange order id for place/cancel.
          exchangeOrderId: executedMixinOrderId,
          // Legacy field name kept for backward compatibility.
          executedMixinOrderId,
          resultStatus:
            intent.type === 'CANCEL_ORDER'
              ? 'CANCELLED'
              : intent.type === 'CREATE_LIMIT_ORDER'
                ? 'PLACED'
                : 'DONE',
        },
      });
      await this.durabilityService?.markProcessed(
        'strategy-intent-execution',
        intent.intentId,
      );
      this.processedIntentIds.add(intent.intentId);
    } catch (error) {
      const classification = classifyCcxtError(error);

      await this.strategyIntentStoreService?.updateIntentStatus(
        intent.intentId,
        'FAILED',
        classification.errorMessage ||
          (error instanceof Error ? error.message : 'unknown error'),
      );

      await this.durabilityService?.appendOutboxEvent({
        topic: 'strategy.intent.failed',
        aggregateType: 'strategy_intent',
        aggregateId: intent.intentId,
        orderId: intent.clientId,
        payload: {
          ...intent,
          orderId: intent.clientId,
          eventType: 'EXECUTION_EVENT',
          eventStatus: 'FAILED',
          executedMixinOrderId,
          error: error instanceof Error ? error.message : 'unknown error',
          errorCode: classification.errorCode,
          retryable: classification.retryable,
          errorCategory: classification.category,
          errorName: classification.errorName,
          errorMessage: classification.errorMessage,
        },
      });

      throw error;
    }
  }

  private async runWithRetries<T>(work: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await work();
      } catch (error) {
        attempt += 1;
        if (attempt > this.maxRetries) {
          throw error;
        }
        const backoffMs = this.retryBaseDelayMs * 2 ** (attempt - 1);

        await this.sleep(backoffMs);
      }
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
