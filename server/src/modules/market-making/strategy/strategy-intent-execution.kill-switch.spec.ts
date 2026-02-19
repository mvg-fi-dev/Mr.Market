import { ConfigService } from '@nestjs/config';

import { StrategyOrderIntent } from './strategy-intent.types';
import { StrategyIntentExecutionService } from './strategy-intent-execution.service';

describe('StrategyIntentExecutionService kill switch', () => {
  const tradeService = {
    executeLimitTrade: jest.fn().mockResolvedValue({ id: 'order-1' }),
  };

  const exchange = {
    cancelOrder: jest.fn().mockResolvedValue(undefined),
  };

  const exchangeInitService = {
    getExchange: jest.fn().mockReturnValue(exchange),
  };

  const exchangeConnectorAdapterService = {
    placeLimitOrder: jest
      .fn()
      .mockResolvedValue({ id: 'order-1', status: 'open' }),
    cancelOrder: jest
      .fn()
      .mockResolvedValue({ id: 'exchange-order-1', status: 'canceled' }),
  };

  const exchangeOrderTrackerService = {
    upsertOrder: jest.fn(),
    countOpen: jest.fn().mockReturnValue(0),
  };

  const intentStoreService = {
    updateIntentStatus: jest.fn().mockResolvedValue(undefined),
    attachMixinOrderId: jest.fn().mockResolvedValue(undefined),
  };

  const durabilityService = {
    isProcessed: jest.fn().mockResolvedValue(false),
    markProcessed: jest.fn().mockResolvedValue(true),
    appendOutboxEvent: jest.fn().mockResolvedValue(undefined),
  };

  const createConfigService = (overrides?: {
    executeIntents?: boolean;
    killSwitchEnabled?: boolean;
  }) =>
    ({
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'strategy.execute_intents') {
          return overrides?.executeIntents ?? true;
        }
        if (key === 'strategy.kill_switch_enabled') {
          return overrides?.killSwitchEnabled ?? false;
        }
        if (key === 'strategy.intent_max_retries') {
          return 0;
        }
        if (key === 'strategy.intent_retry_base_delay_ms') {
          return 1;
        }
        if (key === 'strategy.max_open_orders_per_strategy') {
          return 50;
        }

        return defaultValue;
      }),
    } as unknown as ConfigService);

  const baseIntent: StrategyOrderIntent = {
    type: 'CREATE_LIMIT_ORDER',
    intentId: 'intent-1',
    strategyInstanceId: 'strategy-1',
    strategyKey: 'u1-c1-pureMarketMaking',
    userId: 'u1',
    clientId: 'c1',
    exchange: 'binance',
    pair: 'BTC/USDT',
    side: 'buy',
    price: '100',
    qty: '1',
    createdAt: '2026-02-11T00:00:00.000Z',
    status: 'NEW',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not execute intents when kill switch is enabled (but still marks processed)', async () => {
    const service = new StrategyIntentExecutionService(
      tradeService as any,
      exchangeInitService as any,
      createConfigService({ executeIntents: true, killSwitchEnabled: true }),
      durabilityService as any,
      intentStoreService as any,
      exchangeConnectorAdapterService as any,
      exchangeOrderTrackerService as any,
    );

    await service.consumeIntents([baseIntent]);

    expect(exchangeConnectorAdapterService.placeLimitOrder).not.toHaveBeenCalled();
    expect(intentStoreService.updateIntentStatus).toHaveBeenCalledWith(
      baseIntent.intentId,
      'DONE',
    );

    expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'strategy.intent.skipped',
        aggregateType: 'strategy_intent',
        aggregateId: baseIntent.intentId,
      }),
    );

    expect(durabilityService.markProcessed).toHaveBeenCalledWith(
      'strategy-intent-execution',
      baseIntent.intentId,
    );
  });
});
