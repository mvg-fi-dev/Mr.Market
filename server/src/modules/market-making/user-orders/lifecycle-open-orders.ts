type OutboxEventLike = {
  topic?: string;
  createdAt?: string;
  orderId?: string;
  payload?: string;
};

export type LifecycleOpenOrderV0 = {
  orderId?: string;
  strategyKey?: string;
  traceId?: string;
  exchange?: string;
  pair?: string;
  exchangeOrderId: string;
  side?: 'buy' | 'sell' | string;
  price?: string;
  qty?: string;
  filled?: string;
  remaining?: string;
  averagePrice?: string;
  status: 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'failed' | string;
  updatedAt?: string;
};

function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isOpenStatus(status: unknown): boolean {
  const v = String(status || '').toLowerCase();
  return v === 'open' || v === 'partially_filled' || v === 'partially-filled';
}

function normalizeStatus(status: unknown): LifecycleOpenOrderV0['status'] {
  const v = String(status || '').toLowerCase();

  if (v === 'open' || v === 'new') return 'open';
  if (v === 'partially_filled' || v === 'partially-filled') {
    return 'partially_filled';
  }
  if (v === 'filled' || v === 'closed') return 'filled';
  if (v === 'cancelled' || v === 'canceled') return 'cancelled';

  if (!v.length) return 'failed';
  return v;
}

/**
 * Build a best-effort snapshot of currently-open exchange orders.
 *
 * Goal: make the lifecycle endpoint more replayable after restarts.
 * - Prefer in-memory tracker openOrders when present (real-time).
 * - Fallback to reconstructing from durable outbox events.
 */
export function buildLifecycleOpenOrdersV0(args: {
  orderId: string;
  trackerOpenOrders: LifecycleOpenOrderV0[];
  outboxEvents: OutboxEventLike[];
}): { source: 'tracker' | 'outbox'; openOrders: LifecycleOpenOrderV0[] } {
  if (args.trackerOpenOrders && args.trackerOpenOrders.length > 0) {
    return { source: 'tracker', openOrders: args.trackerOpenOrders };
  }

  // Outbox events are often returned newest-first, but callers may pass any order.
  // For replay, we apply oldest-first (best-effort by createdAt, with stable tie-break).
  const events = [...(args.outboxEvents || [])]
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => {
      const at = a.e.createdAt || '';
      const bt = b.e.createdAt || '';
      if (at && bt) {
        const c = at.localeCompare(bt);
        if (c !== 0) return c;
      } else if (at && !bt) {
        return 1;
      } else if (!at && bt) {
        return -1;
      }

      return a.idx - b.idx;
    })
    .map((x) => x.e);

  const latestByExchangeOrderId = new Map<string, LifecycleOpenOrderV0>();

  for (const e of events) {
    if (!e || typeof e.payload !== 'string' || !e.payload.length) {
      continue;
    }

    const payload = safeJsonParse(e.payload);
    if (!payload || typeof payload !== 'object') {
      continue;
    }

    // Only consider events for this MM orderId (best-effort).
    const payloadOrderId =
      typeof payload.orderId === 'string' ? payload.orderId : undefined;
    const effectiveOrderId = payloadOrderId || e.orderId;

    if (!effectiveOrderId || effectiveOrderId !== args.orderId) {
      continue;
    }

    // Tracker emits this topic with a full order snapshot in payload.
    if (e.topic === 'market_making.exchange_order.status_changed') {
      const exchangeOrderId =
        typeof payload.exchangeOrderId === 'string' ?
          payload.exchangeOrderId
        : typeof payload.aggregateId === 'string' ?
          payload.aggregateId
        : undefined;

      if (!exchangeOrderId) {
        continue;
      }

      const status = normalizeStatus(payload.status || payload.newStatus);

      const row: LifecycleOpenOrderV0 = {
        orderId: payload.orderId,
        strategyKey:
          typeof payload.strategyKey === 'string' ? payload.strategyKey :
            undefined,
        traceId: typeof payload.traceId === 'string' ? payload.traceId :
          undefined,
        exchange: typeof payload.exchange === 'string' ? payload.exchange :
          undefined,
        pair: typeof payload.pair === 'string' ? payload.pair : undefined,
        exchangeOrderId,
        side: typeof payload.side === 'string' ? payload.side : undefined,
        price: typeof payload.price === 'string' ? payload.price : undefined,
        qty: typeof payload.qty === 'string' ? payload.qty : undefined,
        filled: typeof payload.filled === 'string' ? payload.filled : undefined,
        remaining:
          typeof payload.remaining === 'string' ? payload.remaining : undefined,
        averagePrice:
          typeof payload.averagePrice === 'string' ?
            payload.averagePrice
          : undefined,
        status,
        updatedAt:
          typeof payload.updatedAt === 'string' ? payload.updatedAt :
            typeof e.createdAt === 'string' ? e.createdAt
            : undefined,
      };

      latestByExchangeOrderId.set(exchangeOrderId, row);
      continue;
    }

    // As a fallback, some flows might only have trade/cancel outbox events.
    // We DO NOT attempt to build open orders from those, because it's not reliable.
  }

  const openOrders = [...latestByExchangeOrderId.values()].filter((o) =>
    isOpenStatus(o.status),
  );

  return { source: 'outbox', openOrders };
}
