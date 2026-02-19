import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Job, Queue } from 'bull';
import * as ccxt from 'ccxt';

import { getRFC3339Timestamp } from '../../../common/helpers/utils';
import { ExchangeInitService } from '../exchange-init/exchange-init.service';
import { CustomLogger } from '../logger/logger.service';

import { HealthSummaryDto } from './health.dto';

type HEALTH_STATE = 'alive' | 'dead';

@Injectable()
export class HealthService {
  private exchanges = new Map<string, ccxt.Exchange>();
  private readonly logger = new CustomLogger(HealthService.name);

  constructor(
    @InjectQueue('snapshots') private snapshotsQueue: Queue,
    @InjectQueue('market-making') private marketMakingQueue: Queue,
    private exchangeInitService: ExchangeInitService,
  ) {
    // Enable this with api keys in .env
    // this.checkApiKeys()
  }

  private checkApiKeys() {
    if (!process.env.BITFINEX_API_KEY || !process.env.BITFINEX_SECRET) {
      throw new InternalServerErrorException(
        `Bitfinex API key or Secret is invalid`,
      );
    }
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_SECRET) {
      throw new InternalServerErrorException(
        `MEXC API key or Secret is invalid`,
      );
    }
    if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_SECRET) {
      throw new InternalServerErrorException(
        `Binance API key or Secret is invalid`,
      );
    }
  }

  async ping(): Promise<string> {
    return 'pong';
  }

  async getAllHealth(): Promise<HealthSummaryDto> {
    const healthMap = new Map<string, HEALTH_STATE>();
    const allExchanges = Array.from(this.exchanges.values());

    if (allExchanges.length === 0) {
      throw new InternalServerErrorException(`Exchanges are all dead`);
    }

    // Get balance from each exchange to test if API key is valid.
    // Use allSettled so one broken exchange doesn't break the whole health endpoint.
    const settled = await Promise.allSettled(
      allExchanges.map((ex) => Promise.resolve().then(() => ex.fetchBalance())),
    );

    for (let i = 0; i < settled.length; i++) {
      const ex = allExchanges[i];
      const outcome = settled[i];

      if (outcome.status === 'rejected') {
        healthMap.set(ex.name, 'dead');
        this.logger.error(`Exchange ${ex.name} is dead`);
        continue;
      }

      if (!outcome.value) {
        // there is no field like balance in outcome.value
        healthMap.set(ex.name, 'dead');
        this.logger.error(`Exchange ${ex.name} is dead`);
        continue;
      }

      healthMap.set(ex.name, 'alive');
    }

    const exchanges = Array.from(healthMap.entries()).map(([name, status]) => ({
      name,
      status,
    }));

    return {
      ok: exchanges.every((e) => e.status === 'alive'),
      timestamp: getRFC3339Timestamp(),
      exchanges,
    };
  }

  async getExchangeHealth(exchangeName: string): Promise<any> {
    const exchange = this.exchangeInitService.getExchange(exchangeName);

    if (!exchange) {
      throw new BadRequestException(
        'Exchange not found, use GET /strategy/supported-exchanges to get supported exchanges',
      );
    }
    const balance = await exchange.fetchBalance();

    if (!balance) {
      throw new InternalServerErrorException(
        `Exchange ${exchange.name} is dead`,
      );
    }

    return { statusCode: 200, message: 'alive' as HEALTH_STATE };
  }

  /**
   * Check snapshot polling queue health
   * Monitors queue status, job counts, and detects if polling loop is running
   */
  async checkSnapshotPollingHealth(): Promise<any> {
    try {
      const [
        waitingCount,
        activeCount,
        completedCount,
        failedCount,
        delayedCount,
        isPaused,
        activeJobs,
        failedJobs,
        completedJobs,
      ] = await Promise.all([
        this.snapshotsQueue.getWaitingCount(),
        this.snapshotsQueue.getActiveCount(),
        this.snapshotsQueue.getCompletedCount(),
        this.snapshotsQueue.getFailedCount(),
        this.snapshotsQueue.getDelayedCount(),
        this.snapshotsQueue.isPaused(),
        this.snapshotsQueue.getActive(),
        this.snapshotsQueue.getFailed(0, 10), // Get last 10 failed jobs
        this.snapshotsQueue.getCompleted(0, 5), // Get last 5 completed jobs
      ]);

      const lastPollTimestamp = await this.getLastPollTimestamp();
      const isPollingActive =
        lastPollTimestamp !== null && Date.now() - lastPollTimestamp < 30000;

      const nextPollJob = await this.getNextSnapshotPollJob();

      // Detect issues
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (isPaused) {
        issues.push('Queue is paused');
        status = 'critical';
      }

      if (!isPollingActive && activeCount === 0) {
        issues.push('Snapshot polling appears stale');
        status = 'critical';
      }

      if (failedCount > 100) {
        issues.push(`High failure rate: ${failedCount} failed jobs`);
        status = status === 'critical' ? 'critical' : 'warning';
      }

      if (waitingCount > 1000) {
        issues.push(`Large backlog: ${waitingCount} waiting jobs`);
        status = status === 'critical' ? 'critical' : 'warning';
      }

      if (activeCount === 0 && waitingCount > 0) {
        issues.push('No active workers processing waiting jobs');
        status = 'critical';
      }

      // Recent failures analysis
      const recentFailures = failedJobs.map((job) => ({
        id: job.id,
        name: job.name,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        data:
          job.name === 'process_snapshot'
            ? { snapshot_id: job.data?.snapshot_id }
            : undefined,
      }));

      // Map recently completed snapshot jobs for visibility
      const recentlyCompletedSnapshotJobs = completedJobs
        .filter((job) => job.name === 'process_snapshot')
        .map((job) => ({
          id: job.id,
          name: job.name,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        }));

      return {
        status,
        healthy: status === 'healthy',
        timestamp: getRFC3339Timestamp(),
        queue: {
          name: 'snapshots',
          isPaused,
          isPollingActive,
          lastPollTimestamp,
          nextPollJob,
        },
        metrics: {
          waiting: waitingCount,
          active: activeCount,
          completed: completedCount,
          failed: failedCount,
          delayed: delayedCount,
        },
        activeJobs: activeJobs.map((job) => ({
          id: job.id,
          name: job.name,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
        })),
        recentlyCompletedJobs:
          recentlyCompletedSnapshotJobs.length > 0
            ? recentlyCompletedSnapshotJobs
            : undefined,
        issues,
        recentFailures: recentFailures.length > 0 ? recentFailures : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check snapshot polling health: ${error.message}`,
        error.stack,
      );

      return {
        status: 'critical',
        healthy: false,
        timestamp: getRFC3339Timestamp(),
        error: error.message,
        issues: ['Failed to retrieve queue status'],
      };
    }
  }

  private async getLastPollTimestamp(): Promise<number | null> {
    try {
      const redis = (this.snapshotsQueue as any).client;
      const lastPoll = await redis.get('snapshots:last_poll');

      if (!lastPoll) {
        return null;
      }

      const parsed = Number(lastPoll);

      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      this.logger.error(
        `Failed to get last poll timestamp: ${error.message}`,
        error.stack,
      );

      return null;
    }
  }

  private async getNextSnapshotPollJob(): Promise<
    | { id: string; delay: number; timestamp: number }
    | null
  > {
    try {
      const delayedJobs = (await this.snapshotsQueue.getDelayed()) as Job[];

      const pollJobs = delayedJobs
        .filter((job) => job.name === 'poll_snapshots')
        .map((job) => {
          const jobTimestamp = Number(job.timestamp || 0);
          const delay = Number(job.opts?.delay || 0);

          return {
            id: String(job.id),
            delay,
            timestamp: jobTimestamp,
            dueAt: jobTimestamp + delay,
          };
        })
        .filter((job) => Number.isFinite(job.dueAt));

      if (pollJobs.length === 0) {
        return null;
      }

      pollJobs.sort((a, b) => a.dueAt - b.dueAt);

      return {
        id: pollJobs[0].id,
        delay: pollJobs[0].delay,
        timestamp: pollJobs[0].timestamp,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get next snapshot poll job: ${error.message}`,
        error.stack,
      );

      return null;
    }
  }

  async checkMarketMakingQueueHealth(): Promise<any> {
    try {
      const [waitingCount, activeCount, completedCount, failedCount, delayedCount, isPaused] =
        await Promise.all([
          this.marketMakingQueue.getWaitingCount(),
          this.marketMakingQueue.getActiveCount(),
          this.marketMakingQueue.getCompletedCount(),
          this.marketMakingQueue.getFailedCount(),
          this.marketMakingQueue.getDelayedCount(),
          this.marketMakingQueue.isPaused(),
        ]);

      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (isPaused) {
        issues.push('Queue is paused');
        status = 'critical';
      }

      if (failedCount > 200) {
        issues.push(`High failure rate: ${failedCount} failed jobs`);
        status = status === 'critical' ? 'critical' : 'warning';
      }

      if (waitingCount > 2000) {
        issues.push(`Large backlog: ${waitingCount} waiting jobs`);
        status = status === 'critical' ? 'critical' : 'warning';
      }

      if (activeCount === 0 && waitingCount > 0) {
        issues.push('No active workers processing waiting jobs');
        status = 'critical';
      }

      return {
        status,
        healthy: status === 'healthy',
        timestamp: getRFC3339Timestamp(),
        queue: {
          name: 'market-making',
          isPaused,
        },
        metrics: {
          waiting: waitingCount,
          active: activeCount,
          completed: completedCount,
          failed: failedCount,
          delayed: delayedCount,
        },
        issues,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check market-making queue health: ${error.message}`,
        error.stack,
      );

      return {
        status: 'critical',
        healthy: false,
        timestamp: getRFC3339Timestamp(),
        error: error.message,
        issues: ['Failed to retrieve queue status'],
      };
    }
  }
}

