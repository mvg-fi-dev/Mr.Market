import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarketMakingHistory } from 'src/common/entities/market-making/market-making-order.entity';

import { MetricsService } from './metrics.service';

type MarketMakingHistoryRepoMock = {
  query: jest.Mock;
};

describe('MetricsService', () => {
  let service: MetricsService;
  let repository: MarketMakingHistoryRepoMock;

  beforeEach(async () => {
    repository = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: getRepositoryToken(MarketMakingHistory),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses sqlite-safe day bucketing SQL for both queries', async () => {
    repository.query.mockResolvedValue([]);

    await service.getStrategyMetrics();

    expect(repository.query).toHaveBeenCalledTimes(2);
    const firstSql = String(repository.query.mock.calls[0][0]);
    const secondSql = String(repository.query.mock.calls[1][0]);

    expect(firstSql).toContain('DATE("executedAt") AS date');
    expect(secondSql).toContain('DATE("executedAt") AS date');
    expect(firstSql).not.toContain('DATE_TRUNC');
    expect(secondSql).not.toContain('DATE_TRUNC');
  });

  it('merges closed metrics and orderbook volume by strategy and date', async () => {
    repository.query
      .mockResolvedValueOnce([
        {
          exchange: 'binance',
          userId: 'u1',
          clientId: 'c1',
          date: '2026-02-11',
          orders: 2,
          volume: '100',
        },
      ])
      .mockResolvedValueOnce([
        {
          exchange: 'binance',
          userId: 'u1',
          clientId: 'c1',
          date: '2026-02-11',
          volume: '220',
        },
      ]);

    const result = await service.getStrategyMetrics();

    expect(result['binance-u1-c1']).toEqual([
      {
        date: '2026-02-11',
        ordersPlaced: 2,
        tradeVolume: '100',
        orderBookVolume: '220',
      },
    ]);
  });


  it('builds sqlite-safe execution report queries with optional time window', async () => {
    repository.query
      .mockResolvedValueOnce([
        { trades: 3, volume: 100.5, buyVolume: 70.25, sellVolume: 30.25 },
      ])
      .mockResolvedValueOnce([
        {
          date: '2026-02-11',
          trades: 3,
          volume: 100.5,
          buyVolume: 70.25,
          sellVolume: 30.25,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          exchange: 'mexc',
          pair: 'BTC/USDT',
          side: 'buy',
          amount: '0.1',
          price: '1000',
          orderId: 'ex-oid-1',
          executedAt: '2026-02-11T00:00:00.000Z',
          status: 'closed',
          strategy: 'market-making',
          strategyInstanceId: 'si-1',
        },
      ]);

    const report = await service.getExecutionReport({
      orderId: 'order-123',
      from: '2026-02-10T00:00:00.000Z',
      to: '2026-02-12T00:00:00.000Z',
    });

    expect(report.orderId).toBe('order-123');
    expect(report.totals.trades).toBe(3);
    expect(report.byDay[0].date).toBe('2026-02-11');
    expect(report.facts.sample[0].orderId).toBe('ex-oid-1');

    expect(repository.query).toHaveBeenCalledTimes(3);

    const totalsSql = String(repository.query.mock.calls[0][0]);
    const byDaySql = String(repository.query.mock.calls[1][0]);

    expect(totalsSql).toContain('FROM market_making_history');
    expect(totalsSql).toContain('"clientId" = ?');
    expect(totalsSql).toContain('"executedAt" >= ?');
    expect(totalsSql).toContain('"executedAt" <= ?');

    expect(byDaySql).toContain('DATE("executedAt") AS date');
    expect(byDaySql).toContain('GROUP BY DATE("executedAt")');
  });
});
