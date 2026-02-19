import { MarketMakingOrderProcessor } from './market-making.processor';

// Focused tests for idempotency/auditability around join_campaign.
// This step can be delivered at-least-once and must not enqueue duplicate downstream work.

describe('MarketMakingOrderProcessor (join_campaign durability)', () => {
  const createProcessor = (overrides?: { durabilityProcessed?: boolean }) => {
    const userOrdersService = {
      updateMarketMakingOrderState: jest.fn().mockResolvedValue(undefined),
      findMarketMakingByOrderId: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        userId: 'user-1',
        pair: 'BTC-USDT-ERC20',
        exchangeName: 'binance',
        state: 'deposit_confirmed',
      }),
    };

    const strategyService = {
      executePureMarketMakingStrategy: jest.fn(),
      stopStrategyForUser: jest.fn(),
    };

    const localCampaignService = {
      joinCampaign: jest.fn().mockResolvedValue({ id: 'participation-1' }),
    };

    const hufiCampaignService = {
      getCampaigns: jest.fn().mockResolvedValue([]),
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
      localCampaignService as any,
      hufiCampaignService as any,
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
      { update: jest.fn() } as any,
      durabilityService as any,
      { findOne: jest.fn() } as any,
      { findOne: jest.fn() } as any,
      { creditDeposit: jest.fn(), debitWithdrawal: jest.fn() } as any,
    );

    return {
      processor,
      userOrdersService,
      localCampaignService,
      durabilityService,
    };
  };

  it('skips side effects when already processed', async () => {
    const { processor, userOrdersService, localCampaignService, durabilityService } =
      createProcessor({ durabilityProcessed: true });

    const add = jest.fn();

    await processor.handleJoinCampaign({
      data: { orderId: 'order-1' },
      queue: { add },
    } as any);

    expect(durabilityService.isProcessed).toHaveBeenCalledWith(
      'mm.join_campaign',
      'mm:join_campaign:order-1',
    );

    expect(userOrdersService.updateMarketMakingOrderState).not.toHaveBeenCalled();
    expect(localCampaignService.joinCampaign).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(durabilityService.appendOutboxEvent).not.toHaveBeenCalled();
    expect(durabilityService.markProcessed).not.toHaveBeenCalled();
  });

  it('marks processed and emits outbox event after joining', async () => {
    const { processor, durabilityService, userOrdersService, localCampaignService } =
      createProcessor({ durabilityProcessed: false });

    const add = jest.fn().mockResolvedValue(undefined);

    await processor.handleJoinCampaign({
      data: { orderId: 'order-1' },
      queue: { add },
    } as any);

    expect(userOrdersService.updateMarketMakingOrderState).toHaveBeenCalledWith(
      'order-1',
      'joining_campaign',
    );

    expect(localCampaignService.joinCampaign).toHaveBeenCalled();

    expect(add).toHaveBeenCalledWith(
      'start_mm',
      expect.objectContaining({ orderId: 'order-1', userId: 'user-1' }),
      expect.objectContaining({ jobId: 'start_mm_order-1' }),
    );

    expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'mm.campaign.joined',
        aggregateType: 'market_making_order',
        aggregateId: 'order-1',
      }),
    );

    expect(durabilityService.markProcessed).toHaveBeenCalledWith(
      'mm.join_campaign',
      'mm:join_campaign:order-1',
    );
  });
});
