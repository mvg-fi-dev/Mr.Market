import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService', () => {
  const makeService = (deps?: {
    balanceRows?: any[];
    rewards?: any[];
    allocations?: any[];
    intents?: any[];
    orders?: any[];
  }) => {
    const service = new ReconciliationService(
      // balanceReadModelRepository
      { find: jest.fn().mockResolvedValue(deps?.balanceRows ?? []) } as any,
      // exchangeOrderTrackerService
      { getOpenOrders: jest.fn().mockReturnValue([]) } as any,
      // rewardLedgerRepository
      { find: jest.fn().mockResolvedValue(deps?.rewards ?? []) } as any,
      // rewardAllocationRepository
      { find: jest.fn().mockResolvedValue(deps?.allocations ?? []) } as any,
      // strategyOrderIntentRepository
      { find: jest.fn().mockResolvedValue(deps?.intents ?? []) } as any,
      // marketMakingOrderRepository
      { findBy: jest.fn().mockResolvedValue(deps?.orders ?? []) } as any,
      // mmExchangeAllocationRepository
      { findOneBy: jest.fn().mockResolvedValue(null) } as any,
      // marketMakingQueue
      { add: jest.fn().mockResolvedValue(undefined) } as any,
      // growdataRepository
      {
        findMarketMakingPairByExchangeAndSymbol: jest
          .fn()
          .mockResolvedValue(null),
      } as any,
      // durabilityService
      { appendOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any,
    );

    return service;
  };

  it('alerts when exit_withdrawing allocation is missing per-side issued markers', async () => {
    const appendOutboxEvent = jest.fn().mockResolvedValue(undefined);

    const service = new ReconciliationService(
      { find: jest.fn().mockResolvedValue([]) } as any,
      { getOpenOrders: jest.fn().mockReturnValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findBy: jest.fn().mockResolvedValue([
          {
            orderId: 'order-exit-1',
            userId: 'user-1',
            exchangeName: 'mexc',
            pair: 'BTC/USDT',
            state: 'exit_withdrawing',
            createdAt: '2026-02-18T00:00:00.000Z',
          },
        ]),
      } as any,
      {
        findOneBy: jest.fn().mockResolvedValue({
          orderId: 'order-exit-1',
          userId: 'user-1',
          exchange: 'mexc',
          baseAllocatedAmount: '1',
          quoteAllocatedAmount: '2',
          state: 'exit_withdrawing',
          exitWithdrawalStartedAt: '2026-02-18T01:00:00.000Z',
          // base issued, quote missing
          exitBaseIssuedAt: '2026-02-18T01:00:01.000Z',
          exitQuoteIssuedAt: null,
          exitExpectedBaseTxHash: '0xbase',
          exitExpectedQuoteTxHash: '',
        }),
      } as any,
      { add: jest.fn().mockResolvedValue(undefined) } as any,
      {
        findMarketMakingPairByExchangeAndSymbol: jest
          .fn()
          .mockResolvedValue(null),
      } as any,
      { appendOutboxEvent } as any,
    );

    const report = await service.reconcileAllocationInvariants();

    expect(report.violations).toBe(1);
    expect(appendOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'mm.allocation.exit_issued_missing',
        aggregateId: 'order-exit-1',
        orderId: 'order-exit-1',
      }),
    );
  });

  it('reports zero violations when ledger balances are valid', async () => {
    const service = makeService({
      balanceRows: [
        {
          userId: 'u1',
          assetId: 'usdt',
          available: '70',
          locked: '30',
          total: '100',
        },
      ],
    });

    const report = await service.reconcileLedgerInvariants();

    expect(report.violations).toBe(0);
  });

  it('detects ledger invariant violations', async () => {
    const service = makeService({
      balanceRows: [
        {
          userId: 'u1',
          assetId: 'usdt',
          available: '60',
          locked: '30',
          total: '100',
        },
      ],
    });

    const report = await service.reconcileLedgerInvariants();

    expect(report.violations).toBe(1);
  });

  it('detects reward consistency mismatch when allocations exceed reward amount', async () => {
    const service = makeService({
      rewards: [
        { txHash: 'tx-1', amount: '100', campaignId: 'c1', dayIndex: 1 },
      ],
      allocations: [
        { rewardTxHash: 'tx-1', amount: '80' },
        { rewardTxHash: 'tx-1', amount: '30' },
      ],
    });

    const report = await service.reconcileRewardConsistency();

    expect(report.violations).toBe(1);
  });

  it('detects stale SENT intents and DONE intents without exchange order id', async () => {
    const staleTs = '2026-01-01T00:00:00.000Z';
    const service = makeService({
      intents: [
        {
          intentId: 'intent-1',
          type: 'CREATE_LIMIT_ORDER',
          status: 'DONE',
          mixinOrderId: null,
          createdAt: staleTs,
          updatedAt: staleTs,
        },
        {
          intentId: 'intent-2',
          type: 'CREATE_LIMIT_ORDER',
          status: 'SENT',
          mixinOrderId: null,
          createdAt: staleTs,
          updatedAt: staleTs,
        },
      ],
    });

    const report = await service.reconcileIntentLifecycleConsistency();

    expect(report.violations).toBe(2);
  });

  it('re-enqueues monitor_exchange_deposit for deposit_confirming orders (when pair config is available)', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };

    const service = new ReconciliationService(
      { find: jest.fn().mockResolvedValue([]) } as any,
      { getOpenOrders: jest.fn().mockReturnValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findBy: jest.fn().mockResolvedValue([
          {
            orderId: 'order-1',
            exchangeName: 'mexc',
            pair: 'BTC/USDT',
            state: 'deposit_confirming',
            createdAt: '2026-02-18T00:00:00.000Z',
          },
        ]),
      } as any,
      { findOneBy: jest.fn().mockResolvedValue(null) } as any,
      queue as any,
      {
        findMarketMakingPairByExchangeAndSymbol: jest
          .fn()
          .mockResolvedValue({ id: 'pair-1' }),
      } as any,
      { appendOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const report = await service.reconcileDepositConfirmingOrders();

    expect(report.checked).toBe(1);
    expect(report.repaired).toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      'monitor_exchange_deposit',
      expect.objectContaining({
        orderId: 'order-1',
        marketMakingPairId: 'pair-1',
      }),
      expect.objectContaining({
        jobId: 'monitor_exchange_deposit_order-1',
      }),
    );
  });

  it('re-enqueues monitor_exit_mixin_deposit for exit_withdrawing orders (when allocation + pair config are available)', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };

    const findBy = jest
      .fn()
      .mockResolvedValueOnce([
        {
          orderId: 'order-exit-1',
          userId: 'user-1',
          exchangeName: 'mexc',
          pair: 'BTC/USDT',
          state: 'exit_withdrawing',
          createdAt: '2026-02-18T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);

    const service = new ReconciliationService(
      { find: jest.fn().mockResolvedValue([]) } as any,
      { getOpenOrders: jest.fn().mockReturnValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { findBy } as any,
      {
        findOneBy: jest.fn().mockResolvedValue({
          orderId: 'order-exit-1',
          baseAllocatedAmount: '1',
          quoteAllocatedAmount: '2',
          exitExpectedBaseTxHash: '0xbase',
          exitExpectedQuoteTxHash: '0xquote',
          exitWithdrawalStartedAt: '2026-02-18T01:00:00.000Z',
        }),
      } as any,
      queue as any,
      {
        findMarketMakingPairByExchangeAndSymbol: jest.fn().mockResolvedValue({
          exchange_id: 'mexc',
          base_asset_id: 'asset-base',
          quote_asset_id: 'asset-quote',
        }),
      } as any,
      { appendOutboxEvent: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const report = await service.reconcileExitInProgressOrders();

    expect(report.checked).toBe(1);
    expect(report.repaired).toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      'monitor_exit_mixin_deposit',
      expect.objectContaining({
        userId: 'user-1',
        orderId: 'order-exit-1',
        expectedBaseAmount: '1',
        expectedQuoteAmount: '2',
        expectedBaseTxHash: '0xbase',
        expectedQuoteTxHash: '0xquote',
      }),
      expect.objectContaining({
        jobId: 'monitor_exit_mixin_deposit_order-exit-1',
      }),
    );
  });
});
