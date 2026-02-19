import { ExchangeOrderTrackerService } from './exchange-order-tracker.service';

describe('ExchangeOrderTrackerService (fill fields)', () => {
  it('emits outbox event when status is unchanged but fill fields change', async () => {
    const adapter = {
      fetchOrder: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'ex-1',
          status: 'open',
          filled: 0.1,
          remaining: 0.9,
          average: 100,
        })
        .mockResolvedValueOnce({
          id: 'ex-1',
          status: 'open',
          filled: 0.2,
          remaining: 0.8,
          average: 100.1,
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
      strategyKey: 's1',
      exchange: 'binance',
      pair: 'BTC/USDT',
      exchangeOrderId: 'ex-1',
      side: 'buy',
      price: '100',
      qty: '1',
      status: 'open',
      updatedAt: '2026-02-11T00:00:00.000Z',
      filled: '0.1',
      remaining: '0.9',
      averagePrice: '100',
    });

    await service.onTick('2026-02-11T00:00:01.000Z');
    expect(durability.appendOutboxEvent).toHaveBeenCalledTimes(0);

    await service.onTick('2026-02-11T00:00:02.000Z');

    const tracked = service.getByExchangeOrderId('ex-1');

    expect(tracked?.status).toBe('open');
    expect(tracked?.filled).toBe('0.2');
    expect(tracked?.remaining).toBe('0.8');
    expect(tracked?.averagePrice).toBe('100.1');

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
});
