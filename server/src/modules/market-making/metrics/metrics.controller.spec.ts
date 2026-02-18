import { Test, TestingModule } from '@nestjs/testing';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

const mockMetricsService = {
  getStrategyMetrics: jest.fn(),
  getExecutionReport: jest.fn(),
};

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
      controllers: [MetricsController],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates execution report to MetricsService', async () => {
    mockMetricsService.getExecutionReport.mockResolvedValueOnce({
      orderId: 'o1',
      totals: { trades: 0, volume: '0', buyVolume: '0', sellVolume: '0' },
      byDay: [],
      facts: { source: 'market_making_history', fields: [], sample: [] },
    });

    const res = await (controller as any).getExecutionReport(
      'o1',
      undefined,
      undefined,
    );

    expect(mockMetricsService.getExecutionReport).toHaveBeenCalledWith({
      orderId: 'o1',
      from: undefined,
      to: undefined,
    });
    expect(res.orderId).toBe('o1');
  });

  it('returns an error object when orderId is missing', () => {
    const res = (controller as any).getExecutionReport(
      undefined,
      undefined,
      undefined,
    );

    expect(res).toEqual({
      ok: false,
      error: 'Missing required query param: orderId',
    });
  });
});
