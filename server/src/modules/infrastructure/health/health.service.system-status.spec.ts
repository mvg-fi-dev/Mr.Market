import { Test, TestingModule } from '@nestjs/testing';

import { ClockTickCoordinatorService } from 'src/modules/market-making/tick/clock-tick-coordinator.service';

import { ExchangeInitService } from '../exchange-init/exchange-init.service';
import { HealthService } from './health.service';

describe('HealthService (system-status)', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: 'BullQueue_snapshots',
          useValue: {
            getWaitingCount: jest.fn().mockResolvedValue(1),
            getActiveCount: jest.fn().mockResolvedValue(2),
            getCompletedCount: jest.fn().mockResolvedValue(3),
            getFailedCount: jest.fn().mockResolvedValue(4),
            getDelayedCount: jest.fn().mockResolvedValue(5),
            isPaused: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: 'BullQueue_market-making',
          useValue: {
            getWaitingCount: jest.fn().mockResolvedValue(0),
            getActiveCount: jest.fn().mockResolvedValue(0),
            getCompletedCount: jest.fn().mockResolvedValue(0),
            getFailedCount: jest.fn().mockResolvedValue(0),
            getDelayedCount: jest.fn().mockResolvedValue(0),
            isPaused: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: ExchangeInitService,
          useValue: {
            getExchange: jest.fn(),
          },
        },
        {
          provide: ClockTickCoordinatorService,
          useValue: {
            isRunning: jest.fn().mockReturnValue(true),
            getTickSizeMs: jest.fn().mockReturnValue(1000),
            getLastTickAtMs: jest.fn().mockReturnValue(Date.now()),
            getLastTickAt: jest.fn().mockReturnValue('2026-02-19T00:00:00.000Z'),
            getTickCount: jest.fn().mockReturnValue(7),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('returns a combined status bundle with queues + tick info', async () => {
    const status = await service.getSystemStatus();

    expect(typeof status.timestamp).toBe('string');
    expect(status.ok).toBe(true);
    expect(status.issues).toEqual([]);

    expect(status.queues.snapshots).toEqual(
      expect.objectContaining({
        name: 'snapshots',
        isPaused: false,
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 4,
        delayed: 5,
      }),
    );

    expect(status.queues.marketMaking).toEqual(
      expect.objectContaining({
        name: 'market-making',
        isPaused: false,
      }),
    );

    expect(status.tick).toEqual(
      expect.objectContaining({
        running: true,
        tickSizeMs: 1000,
        tickCount: 7,
        recentlyTicked: true,
      }),
    );
  });

  it('flags stale tick loop as an issue', async () => {
    const tick = {
      isRunning: jest.fn().mockReturnValue(true),
      getTickSizeMs: jest.fn().mockReturnValue(1000),
      getLastTickAtMs: jest.fn().mockReturnValue(Date.now() - 31_000),
      getLastTickAt: jest.fn().mockReturnValue('2026-02-19T00:00:00.000Z'),
      getTickCount: jest.fn().mockReturnValue(7),
    };

    (service as any).clockTickCoordinatorService = tick;

    const status = await service.getSystemStatus();

    expect(status.ok).toBe(false);
    expect(status.issues).toContain('Tick loop appears stale');
    expect(status.tick.recentlyTicked).toBe(false);
  });
});
