import { ExchangeOrderTrackerService } from './exchange-order-tracker.service';

describe('ExchangeOrderTrackerService', () => {
  it('upserts order states and returns open orders by strategy', async () => {
    const service = new ExchangeOrderTrackerService();

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-1',
      strategyKey: 'u1-c1-pureMarketMaking',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-1',
      side: 'buy',
      price: '100',
      qty: '1',
      status: 'open',
      updatedAt: '2026-02-11T00:00:00.000Z',
    });

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-2',
      strategyKey: 'u1-c1-pureMarketMaking',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-2',
      side: 'sell',
      price: '101',
      qty: '1',
      status: 'filled',
      updatedAt: '2026-02-11T00:00:01.000Z',
    });

    const openOrders = service.getOpenOrders('u1-c1-pureMarketMaking');

    expect(openOrders).toHaveLength(1);
    expect(openOrders[0].exchangeOrderId).toBe('ex-1');
  });

  it('reconciles order status on tick via adapter poller', async () => {
    const adapter = {
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'ex-1',
        status: 'closed',
        filled: 0.25,
        remaining: 0.75,
        average: 100.5,
      }),
    };
    const durability = {
      appendOutboxEvent: jest.fn(),
    };
    const service = new ExchangeOrderTrackerService(
      undefined as any,
      adapter as any,
      durability as any,
    );

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-1',
      strategyKey: 'u1-c1-pureMarketMaking',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-1',
      side: 'buy',
      price: '100',
      qty: '1',
      status: 'open',
      updatedAt: '2026-02-11T00:00:00.000Z',
    });

    await service.onTick('2026-02-11T00:00:01.000Z');

    const tracked = service.getByExchangeOrderId('ex-1');

    expect(tracked?.status).toBe('filled');
    expect(tracked?.filled).toBe('0.25');
    expect(tracked?.remaining).toBe('0.75');
    expect(tracked?.averagePrice).toBe('100.5');

    expect(durability.appendOutboxEvent).toHaveBeenCalledTimes(1);
    expect(durability.appendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'market_making.exchange_order.status_changed',
        aggregateType: 'exchange_order',
        aggregateId: 'ex-1',
        traceId: 't-1',
        orderId: 'order-1',
      }),
    );
  });

  it('does not emit outbox event if status and fields are unchanged', async () => {
    const adapter = {
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'ex-1',
        status: 'open',
        filled: 0,
        remaining: 1,
        average: undefined,
      }),
    };
    const durability = {
      appendOutboxEvent: jest.fn(),
    };
    const service = new ExchangeOrderTrackerService(
      undefined as any,
      adapter as any,
      durability as any,
    );

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-1',
      strategyKey: 'u1-c1-pureMarketMaking',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-1',
      side: 'buy',
      price: '100',
      qty: '1',
      status: 'open',
      updatedAt: '2026-02-11T00:00:00.000Z',
      filled: '0',
      remaining: '1',
    });

    await service.onTick('2026-02-11T00:00:01.000Z');

    expect(durability.appendOutboxEvent).toHaveBeenCalledTimes(0);
  });

  it('counts open orders including partially_filled', async () => {
    const service = new ExchangeOrderTrackerService();

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-1',
      strategyKey: 's1',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-open',
      side: 'buy',
      price: '100',
      qty: '1',
      status: 'open',
      updatedAt: '2026-02-11T00:00:00.000Z',
    });

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-1',
      strategyKey: 's1',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-partial',
      side: 'sell',
      price: '101',
      qty: '1',
      status: 'partially_filled',
      updatedAt: '2026-02-11T00:00:00.000Z',
    });

    service.upsertOrder({
      orderId: 'order-1',
      traceId: 't-1',
      strategyKey: 's1',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-filled',
      side: 'sell',
      price: '101',
      qty: '1',
      status: 'filled',
      updatedAt: '2026-02-11T00:00:00.000Z',
    });

    service.upsertOrder({
      orderId: 'order-2',
      traceId: 't-2',
      strategyKey: 's2',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-open-s2',
      side: 'buy',
      price: '100',
      qty: '1',
      status: 'open',
      updatedAt: '2026-02-11T00:00:00.000Z',
    });

    expect(service.countAll()).toBe(4);
    expect(service.countOpen()).toBe(3);
    expect(service.countOpen('s1')).toBe(2);
    expect(service.countOpen('s2')).toBe(1);
    expect(service.getOpenOrders('s1')).toHaveLength(2);
  });
});
