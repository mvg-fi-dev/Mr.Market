import { buildLifecycleOpenOrdersV0 } from './lifecycle-open-orders';

describe('buildLifecycleOpenOrdersV0', () => {
  it('prefers tracker open orders when available', () => {
    const res = buildLifecycleOpenOrdersV0({
      orderId: 'o1',
      trackerOpenOrders: [
        {
          exchangeOrderId: 'ex-1',
          status: 'open',
          exchange: 'binance',
          pair: 'BTC/USDT',
        },
      ],
      outboxEvents: [],
    });

    expect(res.source).toBe('tracker');
    expect(res.openOrders).toHaveLength(1);
    expect(res.openOrders[0].exchangeOrderId).toBe('ex-1');
  });

  it('reconstructs open orders from outbox status_changed events when tracker is empty', () => {
    const outboxEvents = [
      {
        topic: 'market_making.exchange_order.status_changed',
        createdAt: '2026-02-19T00:00:00.000Z',
        orderId: 'o1',
        payload: JSON.stringify({
          orderId: 'o1',
          strategyKey: 's1',
          traceId: 't1',
          exchange: 'mexc',
          pair: 'BTC/USDT',
          exchangeOrderId: 'ex-1',
          side: 'buy',
          price: '10',
          qty: '1',
          status: 'open',
          updatedAt: '2026-02-19T00:00:00.000Z',
        }),
      },
      {
        topic: 'market_making.exchange_order.status_changed',
        createdAt: '2026-02-19T00:01:00.000Z',
        orderId: 'o1',
        payload: JSON.stringify({
          orderId: 'o1',
          exchangeOrderId: 'ex-1',
          status: 'partially_filled',
          filled: '0.2',
          remaining: '0.8',
          averagePrice: '10',
          updatedAt: '2026-02-19T00:01:00.000Z',
        }),
      },
      {
        topic: 'market_making.exchange_order.status_changed',
        createdAt: '2026-02-19T00:02:00.000Z',
        orderId: 'o1',
        payload: JSON.stringify({
          orderId: 'o1',
          exchangeOrderId: 'ex-2',
          status: 'filled',
          updatedAt: '2026-02-19T00:02:00.000Z',
        }),
      },
    ];

    const res = buildLifecycleOpenOrdersV0({
      orderId: 'o1',
      trackerOpenOrders: [],
      outboxEvents,
    });

    expect(res.source).toBe('outbox');

    // ex-1 is still open (partially_filled), ex-2 is filled -> filtered out.
    expect(res.openOrders).toHaveLength(1);
    expect(res.openOrders[0].exchangeOrderId).toBe('ex-1');
    expect(res.openOrders[0].status).toBe('partially_filled');
    expect(res.openOrders[0].filled).toBe('0.2');
    expect(res.openOrders[0].remaining).toBe('0.8');
  });

  it('ignores events for other orderId', () => {
    const res = buildLifecycleOpenOrdersV0({
      orderId: 'o1',
      trackerOpenOrders: [],
      outboxEvents: [
        {
          topic: 'market_making.exchange_order.status_changed',
          createdAt: '2026-02-19T00:00:00.000Z',
          orderId: 'o2',
          payload: JSON.stringify({
            orderId: 'o2',
            exchangeOrderId: 'ex-1',
            status: 'open',
          }),
        },
      ],
    });

    expect(res.source).toBe('outbox');
    expect(res.openOrders).toHaveLength(0);
  });

  it('handles malformed JSON payloads', () => {
    const res = buildLifecycleOpenOrdersV0({
      orderId: 'o1',
      trackerOpenOrders: [],
      outboxEvents: [
        {
          topic: 'market_making.exchange_order.status_changed',
          createdAt: '2026-02-19T00:00:00.000Z',
          orderId: 'o1',
          payload: '{ this is not json }',
        },
      ],
    });

    expect(res.source).toBe('outbox');
    expect(res.openOrders).toHaveLength(0);
  });
});
