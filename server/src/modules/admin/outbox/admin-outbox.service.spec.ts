import { OutboxEvent } from 'src/common/entities/system/outbox-event.entity';

import { AdminOutboxService } from './admin-outbox.service';

type Repo<T> = {
  createQueryBuilder: jest.Mock;
};

describe('AdminOutboxService', () => {
  it('falls back to payload LIKE search for traceId/orderId (legacy rows)', async () => {
    const whereCalls: Array<{ expr: string; params: any }> = [];

    const qb: any = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn((expr: string, params: any) => {
        whereCalls.push({ expr, params });
        return qb;
      }),
      getMany: jest.fn().mockResolvedValue([] as OutboxEvent[]),
    };

    const repo: Repo<OutboxEvent> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const service = new AdminOutboxService(repo as any);

    await service.listOutboxEvents({
      traceId: 't-123',
      orderId: 'o-456',
      limit: 50,
    });

    // Ensure we are NOT doing payload-only search; we prefer indexed columns, but still include LIKE fallback.
    expect(whereCalls.some((c) => c.expr.includes('e.traceId') && c.expr.includes('e.payload LIKE'))).toBe(true);
    expect(whereCalls.some((c) => c.expr.includes('e.orderId') && c.expr.includes('e.payload LIKE'))).toBe(true);

    const traceCall = whereCalls.find((c) => c.expr.includes('e.traceId'));
    expect(traceCall?.params?.traceId).toBe('t-123');
    expect(traceCall?.params?.traceLike).toBe('%t-123%');

    const orderCall = whereCalls.find((c) => c.expr.includes('e.orderId'));
    expect(orderCall?.params?.orderId).toBe('o-456');
    expect(orderCall?.params?.orderLike).toBe('%o-456%');
  });

  it('clamps limit to [1, 500] with fallback', async () => {
    const qb: any = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const repo: Repo<OutboxEvent> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const service = new AdminOutboxService(repo as any);

    await service.listOutboxEvents({ limit: 0 } as any);
    expect(qb.limit).toHaveBeenCalledWith(1);

    qb.limit.mockClear();

    await service.listOutboxEvents({ limit: 9999 } as any);
    expect(qb.limit).toHaveBeenCalledWith(500);

    qb.limit.mockClear();

    await service.listOutboxEvents({ limit: 12 } as any);
    expect(qb.limit).toHaveBeenCalledWith(12);
  });
});
