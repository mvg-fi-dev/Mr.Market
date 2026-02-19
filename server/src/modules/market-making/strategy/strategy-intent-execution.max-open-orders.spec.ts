import { ConfigService } from '@nestjs/config';

import { StrategyIntentExecutionService } from './strategy-intent-execution.service';
import { StrategyOrderIntent } from './strategy-intent.types';

describe('StrategyIntentExecutionService (max open orders guard)', () => {
  const tradeService = {
    executeLimitTrade: jest.fn().mockResolvedValue({ id: 'order-1' }),
  };

  const exchangeInitService = {
    getExchange: jest.fn(),
  };

  const exchangeConnectorAdapterService = {
    placeLimitOrder: jest.fn().mockResolvedValue({ id: 'order-1', status: 'open' }),
    cancelOrder: jest.fn(),
  };

  const exchangeOrderTrackerService = {
    upsertOrder: jest.fn(),
    countOpen: jest.fn(),
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

  const createConfigService = (executeIntents: boolean, maxOpen: number) =>
    ({
      get: jest.fn((key: string, defaultValue?: boolean | number) => {
        if (key === 'strategy.execute_intents') {
          return executeIntents;
        }
        if (key === 'strategy.intent_max_retries') {
          return 0;
        }
        if (key === 'strategy.intent_retry_base_delay_ms') {
          return 1;
        }
        if (key === 'strategy.max_open_orders_per_strategy') {
          return maxOpen;
        }

        return defaultValue;
      }),
    } as unknown as ConfigService);

  const baseIntent: StrategyOrderIntent = {
    type: 'CREATE_LIMIT_ORDER',
    intentId: 'intent-guard',
    strategyInstanceId: 'strategy-1',
    strategyKey: 'u1-c1-pureMarketMaking',
    userId: 'u1',
    clientId: 'c1',
    traceId: 't-guard',
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

  it('skips CREATE_LIMIT_ORDER when open orders exceed limit', async () => {
    exchangeOrderTrackerService.countOpen.mockReturnValue(5);

    const service = new StrategyIntentExecutionService(
      tradeService as any,
      exchangeInitService as any,
      createConfigService(true, 5),
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
        aggregateId: baseIntent.intentId,
        payload: expect.objectContaining({
          skipReason: 'MAX_OPEN_ORDERS_REACHED',
          openOrders: 5,
          limit: 5,
        }),
      }),
    );
    expect(durabilityService.markProcessed).toHaveBeenCalledWith(
      'strategy-intent-execution',
      baseIntent.intentId,
    );
  });

  it('still executes CANCEL_ORDER even when open orders exceed limit', async () => {
    exchangeOrderTrackerService.countOpen.mockReturnValue(999);
    exchangeConnectorAdapterService.cancelOrder.mockResolvedValue({
      id: 'exchange-order-1',
      status: 'canceled',
    });

    const service = new StrategyIntentExecutionService(
      tradeService as any,
      exchangeInitService as any,
      createConfigService(true, 1),
      durabilityService as any,
      intentStoreService as any,
      exchangeConnectorAdapterService as any,
      exchangeOrderTrackerService as any,
    );

    await service.consumeIntents([
      {
        ...baseIntent,
        type: 'CANCEL_ORDER',
        intentId: 'intent-cancel-guard',
        mixinOrderId: 'exchange-order-1',
      },
    ]);

    expect(exchangeConnectorAdapterService.cancelOrder).toHaveBeenCalled();
  });
});
