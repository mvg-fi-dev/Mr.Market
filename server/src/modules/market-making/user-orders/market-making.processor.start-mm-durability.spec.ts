import { MarketMakingOrderProcessor } from './market-making.processor';

// Focused tests for idempotency/auditability around start_mm.
// This step must be safe under at-least-once queue delivery to avoid double-starting a strategy.

describe('MarketMakingOrderProcessor (start_mm durability)', () => {
  const createProcessor = (overrides?: { durabilityProcessed?: boolean }) => {
    const userOrdersService = {
      updateMarketMakingOrderState: jest.fn(),
      findMarketMakingByOrderId: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        userId: 'user-1',
        pair: 'BTC-USDT-ERC20',
        exchangeName: 'binance',
        bidSpread: '0.1',
        askSpread: '0.2',
        orderAmount: '10',
        orderRefreshTime: '15000',
        numberOfLayers: '2',
        amountChangePerLayer: '0',
        ceilingPrice: '0',
        floorPrice: '0',
        state: 'deposit_confirmed',
      }),
    };

    const strategyService = {
      executePureMarketMakingStrategy: jest.fn().mockResolvedValue(undefined),
      stopStrategyForUser: jest.fn(),
    };

    const durabilityService = {
      isProcessed: jest
        .fn()
        .mockResolvedValue(Boolean(overrides?.durabilityProcessed)),
      markProcessed: jest.fn().mockResolvedValue(true),
      appendOutboxEvent: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new MarketMakingOrderProcessor(
      userOrdersService as any,
      strategyService as any,
      { calculateMoveFundsFee: jest.fn() } as any,
      { findMarketMakingPairById: jest.fn() } as any,
      { refund: jest.fn(), transfer: jest.fn() } as any,
      { executeWithdrawal: jest.fn() } as any,
      { joinCampaign: jest.fn() } as any,
      { getCampaigns: jest.fn() } as any,
      {
        findFirstAPIKeyByExchange: jest.fn(),
        getDepositAddress: jest.fn(),
        getDeposits: jest.fn(),
        getBalanceBySymbol: jest.fn(),
        createWithdrawal: jest.fn(),
      } as any,
      { getNetworkForAsset: jest.fn() } as any,
      {} as any,
      { depositAddress: jest.fn() } as any,
      { pauseAndDrainOrders: jest.fn() } as any,
      { getByOrderId: jest.fn(), getOrCreate: jest.fn() } as any,
      { get: jest.fn().mockReturnValue(false) } as any,
      { findOne: jest.fn() } as any,
      durabilityService as any,
      { update: jest.fn() } as any,
      { findOne: jest.fn() } as any,
      { creditDeposit: jest.fn(), debitWithdrawal: jest.fn() } as any,
    );

    return { processor, userOrdersService, strategyService, durabilityService };
  };

  it('skips side effects when already processed', async () => {
    const { processor, userOrdersService, strategyService, durabilityService } =
      createProcessor({ durabilityProcessed: true });

    await processor.handleStartMM({
      data: { userId: 'user-1', orderId: 'order-1' },
      queue: { add: jest.fn() },
    } as any);

    expect(durabilityService.isProcessed).toHaveBeenCalledWith(
      'mm.start_mm',
      'mm:start_mm:order-1',
    );

    expect(userOrdersService.updateMarketMakingOrderState).not.toHaveBeenCalled();
    expect(strategyService.executePureMarketMakingStrategy).not.toHaveBeenCalled();
    expect(durabilityService.appendOutboxEvent).not.toHaveBeenCalled();
    expect(durabilityService.markProcessed).not.toHaveBeenCalled();
  });

  it('marks processed and emits outbox event after starting', async () => {
    const { processor, durabilityService } = createProcessor({
      durabilityProcessed: false,
    });

    await processor.handleStartMM({
      data: { userId: 'user-1', orderId: 'order-1' },
      queue: { add: jest.fn() },
    } as any);

    expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'mm.started',
        aggregateType: 'market_making_order',
        aggregateId: 'order-1',
      }),
    );

    expect(durabilityService.markProcessed).toHaveBeenCalledWith(
      'mm.start_mm',
      'mm:start_mm:order-1',
    );
  });
});
