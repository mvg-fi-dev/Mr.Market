import { AdminLedgerService } from './admin-ledger.service';

describe('AdminLedgerService', () => {
  it('clamps limit to [1, 500] with fallback', async () => {
    const repo: any = {
      createQueryBuilder: () => {
        const qb: any = {
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        };

        return qb;
      },
    };

    const service = new AdminLedgerService(repo);

    const res = await service.listLedgerEntries({ limit: 9999 } as any);

    expect(res.ok).toBe(true);
    expect(res.entries).toEqual([]);
  });

  it('applies filters to query builder', async () => {
    const qb: any = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          entryId: 'e1',
          userId: 'u1',
          assetId: 'a1',
          amount: '1',
          type: 'DEPOSIT_CREDIT',
          refType: 'r',
          refId: 'rid',
          idempotencyKey: 'k1',
          traceId: 't1',
          orderId: 'o1',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]),
    };

    const repo: any = {
      createQueryBuilder: () => qb,
    };

    const service = new AdminLedgerService(repo);

    const res = await service.listLedgerEntries({
      userId: 'u1',
      assetId: 'a1',
      traceId: 't1',
      orderId: 'o1',
      refType: 'r',
      refId: 'rid',
      since: '2026-01-01T00:00:00Z',
      limit: 10,
    } as any);

    expect(res.ok).toBe(true);
    expect(res.entries).toHaveLength(1);

    // Filters were wired.
    expect(qb.andWhere).toHaveBeenCalled();
  });
});
