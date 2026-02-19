import { Test, TestingModule } from '@nestjs/testing';

import { AdminStrategyService } from '../../admin/strategy/adminStrategy.service';
import { StrategyController } from './strategy.controller';
import { StrategyService } from './strategy.service';

const mockStrategyService = {
  listIntentsByClientId: jest.fn(),
};

describe('StrategyController', () => {
  let controller: StrategyController;
  // let adminService: AdminStrategyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StrategyController],
      providers: [
        {
          provide: AdminStrategyService,
          useValue: {
            joinStrategy: jest.fn(),
          }, // Use the mock admin here
        },
        {
          provide: StrategyService,
          useValue: mockStrategyService, // Use the mock StrategyService here
        },
      ],
    }).compile();

    controller = module.get<StrategyController>(StrategyController);
    // adminService = module.get<AdminStrategyService>(AdminStrategyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists intents by clientId via StrategyService', async () => {
    mockStrategyService.listIntentsByClientId.mockResolvedValueOnce([
      {
        intentId: 'i1',
        strategyInstanceId: 's1',
        strategyKey: 'k1',
        userId: 'u1',
        clientId: 'order-123',
        traceId: 't1',
        type: 'CREATE_LIMIT_ORDER',
        exchange: 'mexc',
        pair: 'BTC/USDT',
        side: 'buy',
        price: '100',
        qty: '1',
        mixinOrderId: 'ex-1',
        status: 'DONE',
        errorReason: null,
        createdAt: '2026-02-19T00:00:00.000Z',
        updatedAt: '2026-02-19T00:00:00.000Z',
      },
    ]);

    const res = await (controller as any).listIntentsByClientId(
      'order-123',
      '50',
    );

    expect(mockStrategyService.listIntentsByClientId).toHaveBeenCalledWith(
      'order-123',
      50,
    );
    expect(res).toHaveLength(1);
    expect(res[0].clientId).toBe('order-123');
  });
});
