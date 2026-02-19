import { MarketMakingOrderProcessor } from './market-making.processor';

// Focused tests for idempotency/auditability around monitor_exchange_deposit.
// The goal is to ensure that completed deposit confirmation is safe under at-least-once delivery.

describe('MarketMakingOrderProcessor (monitor_exchange_deposit durability)', () => {
  const createProcessor = (overrides?: {
    durabilityProcessed?: boolean;
  }) => {
    const userOrdersService = {
      updateMarketMakingOrderState: jest.fn(),
      findMarketMakingByOrderId: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        userId: 'user-1',
        pair: 'BTC/USDT',
        exchangeName: 'mexc',
        state: 'deposit_confirming',
      }),
    };

    const paymentStateRepository = {
      findOne: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        baseAssetId: 'asset-base',
        quoteAssetId: 'asset-quote',
        baseAssetAmount: '1',
        quoteAssetAmount: '2',
      }),
      save: jest.fn(),
      create: jest.fn((payload) => payload),
    };

    const growDataRepository = {
      findMarketMakingPairById: jest.fn().mockResolvedValue({
        exchange_id: 'mexc',
        base_symbol: 'BTC',
        quote_symbol: 'USDT',
      }),
    };

    const allocationService = {
      getOrCreate: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
      markExchangeDepositConfirmed: jest.fn().mockResolvedValue(undefined),
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
      { executePureMarketMakingStrategy: jest.fn() } as any,
      { calculateMoveFundsFee: jest.fn() } as any,
      growDataRepository as any,
      { refund: jest.fn(), transfer: jest.fn() } as any,
      { executeWithdrawal: jest.fn() } as any,
      { joinCampaign: jest.fn() } as any,
      { getCampaigns: jest.fn() } as any,
      {
        findFirstAPIKeyByExchange: jest.fn().mockResolvedValue({ key_id: 'k1' }),
        getDeposits: jest.fn().mockResolvedValue([
          { currency: 'BTC', network: 'ERC20', amount: '1', txid: '0xbase' },
          { currency: 'USDT', network: 'ERC20', amount: '2', txHash: '0xquote' },
        ]),
      } as any,
      {
        getNetworkForAsset: jest.fn().mockResolvedValue('ERC20'),
      } as any,
      { client: { safe: { fetchSafeSnapshot: jest.fn() } } } as any,
      { depositAddress: jest.fn() } as any,
      { pauseAndDrainOrders: jest.fn() } as any,
      allocationService as any,
      { get: jest.fn().mockReturnValue(false) } as any,
      paymentStateRepository as any,
      durabilityService as any,
      { update: jest.fn() } as any,
      { findOne: jest.fn() } as any,
      { creditDeposit: jest.fn(), debitWithdrawal: jest.fn() } as any,
    );

    return {
      processor,
      userOrdersService,
      allocationService,
      durabilityService,
    };
  };

  it('skips side effects when already processed', async () => {
    const { processor, userOrdersService, allocationService, durabilityService } =
      createProcessor({ durabilityProcessed: true });

    const queue = { add: jest.fn() };

    await processor.handleMonitorExchangeDeposit({
      data: {
        orderId: 'order-1',
        marketMakingPairId: 'pair-1',
        startedAt: Date.now(),
        baseWithdrawalTxHash: '0xbase',
        quoteWithdrawalTxHash: '0xquote',
      },
      attemptsMade: 0,
      queue,
      update: jest.fn(),
    } as any);

    expect(durabilityService.isProcessed).toHaveBeenCalledWith(
      'mm.monitor_exchange_deposit',
      'mm:monitor_exchange_deposit:order-1',
    );

    expect(userOrdersService.updateMarketMakingOrderState).not.toHaveBeenCalled();
    expect(allocationService.getOrCreate).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('marks processed and appends outbox event when deposits confirmed', async () => {
    const { processor, durabilityService } = createProcessor({
      durabilityProcessed: false,
    });

    const queue = { add: jest.fn() };

    await processor.handleMonitorExchangeDeposit({
      data: {
        orderId: 'order-1',
        marketMakingPairId: 'pair-1',
        startedAt: Date.now(),
        baseWithdrawalTxHash: '0xbase',
        quoteWithdrawalTxHash: '0xquote',
      },
      attemptsMade: 0,
      queue,
      update: jest.fn(),
    } as any);

    expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'mm.deposit.confirmed',
        aggregateType: 'market_making_order',
        aggregateId: 'order-1',
      }),
    );

    expect(durabilityService.markProcessed).toHaveBeenCalledWith(
      'mm.monitor_exchange_deposit',
      'mm:monitor_exchange_deposit:order-1',
    );
  });
});
