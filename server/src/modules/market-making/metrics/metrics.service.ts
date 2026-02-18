import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketMakingHistory } from 'src/common/entities/market-making/market-making-order.entity';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';
import { Repository } from 'typeorm';

@Injectable()
export class MetricsService {
  private readonly logger = new CustomLogger(MetricsService.name);

  constructor(
    @InjectRepository(MarketMakingHistory)
    private readonly orderRepository: Repository<MarketMakingHistory>,
  ) {}

  public async getStrategyMetrics() {
    const closedOrderAndVolume = await this.orderRepository.query(
      `SELECT
        "exchange",
        "userId",
        "clientId",
        DATE("executedAt") AS date,
        COUNT(*) AS orders,
        SUM("amount" * "price") AS volume
      FROM market_making_history
      WHERE status = 'closed'
      GROUP BY "exchange", "userId", "clientId", date
      ORDER BY "exchange", "userId", "clientId", date
      `,
    );

    const orderBookVolume = await this.orderRepository.query(`SELECT
        "exchange",
        "userId",
        "clientId",
        DATE("executedAt") AS date,
        SUM("amount" * "price") AS volume
      FROM market_making_history
      GROUP BY "exchange", "userId", "clientId", date
      ORDER BY "exchange", "userId", "clientId", date
      `);

    const metrics = {};

    closedOrderAndVolume.forEach((item) => {
      const strategyKey = `${item.exchange}-${item.userId}-${item.clientId}`;

      if (!metrics[strategyKey]) {
        metrics[strategyKey] = [];
      }

      metrics[strategyKey].push({
        date: item.date,
        ordersPlaced: item.orders,
        tradeVolume: item.volume,
      });
    });

    orderBookVolume.forEach((item) => {
      const strategyKey = `${item.exchange}-${item.userId}-${item.clientId}`;

      if (!metrics[strategyKey]) {
        metrics[strategyKey] = [];
      }

      if (!metrics[strategyKey].some((m) => m.date === item.date)) {
        metrics[strategyKey].push({
          date: item.date,
          orderBookVolume: item.volume,
        });
      } else {
        for (let i = 0; i < metrics[strategyKey].length; i++) {
          if (metrics[strategyKey][i].date === item.date) {
            metrics[strategyKey][i].orderBookVolume = item.volume;
          }
        }
      }
    });

    return metrics;
  }

  /**
   * Execution report v0.
   *
   * Goal: given an orderId and a time window, return a reproducible bundle
   * referencing raw exchange facts we already store (market_making_history).
   *
   * Notes:
   * - "orderId" here maps to MarketMakingHistory.clientId for pure MM flows.
   * - Keep SQL SQLite-safe (avoid DATE_TRUNC).
   */
  public async getExecutionReport(params: {
    orderId: string;
    from?: string; // ISO datetime
    to?: string; // ISO datetime
  }): Promise<{
    orderId: string;
    from?: string;
    to?: string;
    totals: {
      trades: number;
      volume: string;
      buyVolume: string;
      sellVolume: string;
    };
    byDay: Array<{
      date: string;
      trades: number;
      volume: string;
      buyVolume: string;
      sellVolume: string;
    }>;
    facts: {
      source: 'market_making_history';
      fields: string[];
      sample: Array<{
        id: number;
        exchange: string;
        pair: string;
        side: string;
        amount: string;
        price: string;
        orderId: string;
        executedAt: string;
        status: string;
        strategy: string;
        strategyInstanceId: string;
      }>;
    };
  }> {
    const { orderId, from, to } = params;

    const where: string[] = ['"clientId" = ?'];
    const args: any[] = [orderId];

    if (from) {
      where.push('"executedAt" >= ?');
      args.push(from);
    }
    if (to) {
      where.push('"executedAt" <= ?');
      args.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalsRows = await this.orderRepository.query(
      `SELECT
        COUNT(*) AS trades,
        COALESCE(SUM(CAST("amount" AS REAL) * CAST("price" AS REAL)), 0) AS volume,
        COALESCE(SUM(CASE WHEN "side" = 'buy' THEN CAST("amount" AS REAL) * CAST("price" AS REAL) ELSE 0 END), 0) AS buyVolume,
        COALESCE(SUM(CASE WHEN "side" = 'sell' THEN CAST("amount" AS REAL) * CAST("price" AS REAL) ELSE 0 END), 0) AS sellVolume
      FROM market_making_history
      ${whereSql}`,
      args,
    );

    const byDayRows = await this.orderRepository.query(
      `SELECT
        DATE("executedAt") AS date,
        COUNT(*) AS trades,
        COALESCE(SUM(CAST("amount" AS REAL) * CAST("price" AS REAL)), 0) AS volume,
        COALESCE(SUM(CASE WHEN "side" = 'buy' THEN CAST("amount" AS REAL) * CAST("price" AS REAL) ELSE 0 END), 0) AS buyVolume,
        COALESCE(SUM(CASE WHEN "side" = 'sell' THEN CAST("amount" AS REAL) * CAST("price" AS REAL) ELSE 0 END), 0) AS sellVolume
      FROM market_making_history
      ${whereSql}
      GROUP BY DATE("executedAt")
      ORDER BY DATE("executedAt") ASC`,
      args,
    );

    const sampleRows = await this.orderRepository.query(
      `SELECT
        "id",
        "exchange",
        "pair",
        "side",
        "amount",
        "price",
        "orderId",
        "executedAt",
        "status",
        "strategy",
        "strategyInstanceId"
      FROM market_making_history
      ${whereSql}
      ORDER BY "executedAt" DESC
      LIMIT 50`,
      args,
    );

    const totals = totalsRows?.[0] || {
      trades: 0,
      volume: '0',
      buyVolume: '0',
      sellVolume: '0',
    };

    return {
      orderId,
      from,
      to,
      totals: {
        trades: Number(totals.trades || 0),
        volume: String(totals.volume ?? '0'),
        buyVolume: String(totals.buyVolume ?? '0'),
        sellVolume: String(totals.sellVolume ?? '0'),
      },
      byDay: (byDayRows || []).map((r: any) => ({
        date: String(r.date),
        trades: Number(r.trades || 0),
        volume: String(r.volume ?? '0'),
        buyVolume: String(r.buyVolume ?? '0'),
        sellVolume: String(r.sellVolume ?? '0'),
      })),
      facts: {
        source: 'market_making_history',
        fields: [
          'id',
          'exchange',
          'pair',
          'side',
          'amount',
          'price',
          'orderId',
          'executedAt',
          'status',
          'strategy',
          'strategyInstanceId',
        ],
        sample: (sampleRows || []).map((r: any) => ({
          id: Number(r.id),
          exchange: String(r.exchange),
          pair: String(r.pair),
          side: String(r.side),
          amount: String(r.amount ?? ''),
          price: String(r.price ?? ''),
          orderId: String(r.orderId),
          executedAt: r.executedAt ? String(r.executedAt) : '',
          status: String(r.status ?? ''),
          strategy: String(r.strategy ?? ''),
          strategyInstanceId: String(r.strategyInstanceId ?? ''),
        })),
      },
    };
  }

}
