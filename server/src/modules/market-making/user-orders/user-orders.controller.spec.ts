import { Test, TestingModule } from '@nestjs/testing';

import { AdminOutboxService } from 'src/modules/admin/outbox/admin-outbox.service';

import { StrategyService } from '../strategy/strategy.service';
import { UserOrdersController } from './user-orders.controller';
import { UserOrdersService } from './user-orders.service';

describe('UserOrdersController', () => {
  let controller: UserOrdersController;

  const mockUserOrdersService = {
    findMarketMakingByOrderId: jest.fn(),
    getMarketMakingHistoryByStrategyInstanceId: jest.fn(),
  };

  const mockStrategyService = {
    listIntentsByClientId: jest.fn(),
    getOpenOrders: jest.fn(),
  };

  const mockAdminOutboxService = {
    listOutboxEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserOrdersController],
      providers: [
        { provide: UserOrdersService, useValue: mockUserOrdersService },
        { provide: StrategyService, useValue: mockStrategyService },
        { provide: AdminOutboxService, useValue: mockAdminOutboxService },
      ],
    }).compile();

    controller = module.get<UserOrdersController>(UserOrdersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns lifecycle bundle for an order', async () => {
    mockUserOrdersService.findMarketMakingByOrderId.mockResolvedValueOnce({
      orderId: 'order-1',
      userId: 'user-1',
    });

    mockStrategyService.listIntentsByClientId.mockResolvedValueOnce([
      { intentId: 'i1', clientId: 'order-1' },
    ]);

    mockUserOrdersService.getMarketMakingHistoryByStrategyInstanceId.mockResolvedValueOnce(
      [{ id: 1 }],
    );

    mockStrategyService.getOpenOrders.mockReturnValueOnce([
      { exchangeOrderId: 'ex-1', status: 'open' },
    ]);

    mockAdminOutboxService.listOutboxEvents.mockResolvedValueOnce({
      ok: true,
      events: [{ eventId: 'e1', topic: 't1' }],
    });

    const res = await (controller as any).getMarketMakingLifecycle('order-1');

    expect(
      mockUserOrdersService.findMarketMakingByOrderId,
    ).toHaveBeenCalledWith('order-1');

    expect(mockStrategyService.listIntentsByClientId).toHaveBeenCalledWith(
      'order-1',
      500,
    );

    expect(
      mockUserOrdersService.getMarketMakingHistoryByStrategyInstanceId,
    ).toHaveBeenCalledWith('order-1');

    expect(mockStrategyService.getOpenOrders).toHaveBeenCalledWith(
      'user-1-order-1-pureMarketMaking',
    );

    expect(res.ok).toBe(true);
    expect(res.orderId).toBe('order-1');
    expect(res.intents).toHaveLength(1);
    expect(res.openOrders).toHaveLength(1);
    expect(res.history).toHaveLength(1);
    expect(res.outbox).toHaveLength(1);

    expect(mockAdminOutboxService.listOutboxEvents).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', limit: 500 }),
    );
  });

  it('returns ok:false when order is not found', async () => {
    mockUserOrdersService.findMarketMakingByOrderId.mockResolvedValueOnce(null);

    const res = await (controller as any).getMarketMakingLifecycle('missing');

    expect(res).toEqual({ ok: false, error: 'order not found' });
  });
});
