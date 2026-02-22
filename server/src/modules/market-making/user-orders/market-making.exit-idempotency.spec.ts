import { MarketMakingOrderProcessor } from './market-making.processor';

describe('MarketMakingOrderProcessor (exit idempotency)', () => {
  const createProcessor = () => {
    const userOrdersService = {
      updateMarketMakingOrderState: jest.fn().mockResolvedValue(undefined),
      findMarketMakingByOrderId: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        userId: 'user-1',
        pair: 'BTC-USDT-ERC20',
        exchangeName: 'binance',
        state: 'exit_requested',
      }),
    };

    const paymentStateRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
    };

    const marketMakingRepository = {
      findOne: jest.fn().mockResolvedValue({ userId: 'user-1' }),
      create: jest.fn(),
      save: jest.fn(),
    };

    const durabilityService = {
      isProcessed: jest.fn().mockResolvedValue(false),
      markProcessed: jest.fn().mockResolvedValue(true),
      appendOutboxEvent: jest.fn().mockResolvedValue(undefined),
    };

    const allocationService = {
      getByOrderId: jest
        .fn()
        // allocation (base already issued, quote not issued yet)
        .mockResolvedValueOnce({
          baseAllocatedAmount: '1',
          quoteAllocatedAmount: '2',
          state: 'exit_withdrawing',
          exitWithdrawalStartedAt: '2026-02-18T01:00:00.000Z',
          exitBaseIssuedAt: '2026-02-18T01:00:01.000Z',
          exitExpectedBaseTxHash: '0xbase',
        })
        // nextAllocation (still quote not issued; markExitWithdrawing is mocked)
        .mockResolvedValueOnce({
          baseAllocatedAmount: '1',
          quoteAllocatedAmount: '2',
          state: 'exit_withdrawing',
          exitWithdrawalStartedAt: '2026-02-18T01:00:00.000Z',
          exitBaseIssuedAt: '2026-02-18T01:00:01.000Z',
          exitExpectedBaseTxHash: '0xbase',
        })
        // finalAllocation (pretend quote marker persisted)
        .mockResolvedValueOnce({
          baseAllocatedAmount: '1',
          quoteAllocatedAmount: '2',
          state: 'exit_withdrawing',
          exitWithdrawalStartedAt: '2026-02-18T01:00:00.000Z',
          exitBaseIssuedAt: '2026-02-18T01:00:01.000Z',
          exitQuoteIssuedAt: '2026-02-18T01:00:02.000Z',
          exitExpectedBaseTxHash: '0xbase',
          exitExpectedQuoteTxHash: '0xquote',
        }),
      markExitWithdrawing: jest.fn().mockResolvedValue(undefined),
      markExitComplete: jest.fn().mockResolvedValue(undefined),
      getOrCreate: jest.fn(),
      markExchangeDepositConfirmed: jest.fn(),
    };

    const processor = new MarketMakingOrderProcessor(
      userOrdersService as any,
      // strategyService
      {
        executeMMCycle: jest.fn(),
        executePureMarketMakingStrategy: jest.fn(),
        stopStrategyForUser: jest.fn(),
      } as any,
      // feeService
      {
        calculateMoveFundsFee: jest.fn().mockResolvedValue({
          base_fee_id: 'asset-fee-base',
          quote_fee_id: 'asset-fee-quote',
          base_fee_amount: '1',
          quote_fee_amount: '2',
          market_making_fee_percentage: '0.1',
        }),
      } as any,
      // growDataRepository
      {
        findMarketMakingPairById: jest.fn().mockResolvedValue({
          enable: true,
          exchange_id: 'binance',
          symbol: 'BTC/USDT',
          base_asset_id: 'asset-base',
          quote_asset_id: 'asset-quote',
        }),
        findMarketMakingPairByExchangeAndSymbol: jest.fn().mockResolvedValue({
          exchange_id: 'binance',
          symbol: 'BTC/USDT',
          base_asset_id: 'asset-base',
          quote_asset_id: 'asset-quote',
          base_symbol: 'BTC',
          quote_symbol: 'USDT',
        }),
      } as any,
      // transactionService
      { refund: jest.fn().mockResolvedValue([{}]), transfer: jest.fn() } as any,
      // withdrawalService
      { executeWithdrawal: jest.fn() } as any,
      // localCampaignService
      { joinCampaign: jest.fn() } as any,
      // hufiCampaignService
      { getCampaigns: jest.fn() } as any,
      // exchangeService
      {
        findFirstAPIKeyByExchange: jest
          .fn()
          .mockResolvedValue({ key_id: 'key-1', api_key: 'k', api_secret: 's' }),
        getDepositAddress: jest.fn(),
        getDeposits: jest.fn(),
        getBalanceBySymbol: jest.fn(),
        createWithdrawal: jest.fn().mockResolvedValue({ txid: '0xquote' }),
      } as any,
      // networkMappingService
      { getNetworkForAsset: jest.fn().mockResolvedValue('ERC20') } as any,
      // mixinClientService
      {} as any,
      // walletService
      {
        depositAddress: jest.fn().mockResolvedValue({ address: 'addr', memo: '' }),
      } as any,
      // pauseWithdrawOrchestratorService
      { pauseAndDrainOrders: jest.fn().mockResolvedValue(undefined) } as any,
      // allocationService
      allocationService as any,
      // configService
      { get: jest.fn().mockReturnValue(false) } as any,
      // paymentStateRepository
      paymentStateRepository as any,
      // durabilityService
      durabilityService as any,
      // marketMakingOrderIntentRepository
      { update: jest.fn(), findOne: jest.fn(), save: jest.fn() } as any,
      // marketMakingRepository
      marketMakingRepository as any,
      // balanceLedgerService
      {
        creditDeposit: jest.fn().mockResolvedValue({ applied: true }),
        debitWithdrawal: jest.fn().mockResolvedValue({ applied: true }),
      } as any,
    );

    return { processor, userOrdersService, allocationService };
  };

  it('only withdraws missing side when base was already issued', async () => {
    const { processor } = createProcessor();

    const queue = { add: jest.fn() };

    await processor.handleExitWithdrawal({
      data: { userId: 'user-1', orderId: 'order-1' },
      queue,
    } as any);

    // Only quote withdrawal is executed (base already issued).
    expect((processor as any).exchangeService.createWithdrawal).toHaveBeenCalledTimes(
      1,
    );

    // Monitor is queued.
    expect(queue.add).toHaveBeenCalledWith(
      'monitor_exit_mixin_deposit',
      expect.objectContaining({
        userId: 'user-1',
        orderId: 'order-1',
        expectedBaseTxHash: '0xbase',
        expectedQuoteTxHash: '0xquote',
      }),
      expect.objectContaining({ jobId: 'monitor_exit_mixin_deposit_order-1' }),
    );
  });
});
