import { MarketMakingOrderProcessor } from '../market-making.processor';

const createMockJob = (data: any) => {
  return {
    data,
    attemptsMade: 0,
    update: jest.fn(async () => undefined),
    queue: {
      add: jest.fn(async () => undefined),
    },
  } as any;
};

describe('MarketMakingOrderProcessor idempotency guards', () => {
  it('withdraw_to_exchange should be idempotent: if payment state already has withdrawal tx ids, do not execute withdrawals twice', async () => {
    const userOrdersService = {
      updateMarketMakingOrderState: jest.fn(async () => undefined),
    } as any;

    const paymentStateRepository = {
      findOne: jest.fn(async () => ({
        orderId: 'o1',
        userId: 'u1',
        baseAssetId: 'a_base',
        quoteAssetId: 'a_quote',
        baseAssetAmount: '1',
        quoteAssetAmount: '2',
        // Persisted fields: already withdrew
        baseWithdrawalTxId: 'tx_base',
        quoteWithdrawalTxId: 'tx_quote',
      })),
      update: jest.fn(async () => ({ affected: 1 })),
    } as any;

    const growDataRepository = {
      findMarketMakingPairById: jest.fn(async () => ({
        exchange_id: 'mexc',
        base_symbol: 'BTC',
        quote_symbol: 'USDT',
      })),
    } as any;

    const exchangeService = {
      findFirstAPIKeyByExchange: jest.fn(async () => ({ key_id: 'k1' })),
      getDepositAddress: jest.fn(async () => ({ address: 'addr', memo: null })),
    } as any;

    const networkMappingService = {
      getNetworkForAsset: jest.fn(async () => 'BTC'),
    } as any;

    const withdrawalService = {
      executeWithdrawal: jest.fn(async () => [
        { request_id: 'SHOULD_NOT_CALL' },
      ]),
    } as any;

    const processor = new MarketMakingOrderProcessor(
      userOrdersService,
      {} as any,
      {} as any,
      growDataRepository,
      {} as any,
      withdrawalService,
      {} as any,
      {} as any,
      exchangeService,
      networkMappingService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn(() => true) } as any,
      paymentStateRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const job = createMockJob({
      orderId: 'o1',
      marketMakingPairId: 'pair1',
      traceId: 't1',
    });

    await processor.handleWithdrawToExchange(job);

    expect(withdrawalService.executeWithdrawal).not.toHaveBeenCalled();

    expect(job.queue.add).toHaveBeenCalledWith(
      'monitor_mixin_withdrawal',
      expect.objectContaining({
        orderId: 'o1',
        baseWithdrawalTxId: 'tx_base',
        quoteWithdrawalTxId: 'tx_quote',
      }),
      expect.any(Object),
    );
  });

  it('monitor_mixin_withdrawal should use persisted tx ids when missing from job payload (crash-safe requeue)', async () => {
    const userOrdersService = {
      updateMarketMakingOrderState: jest.fn(async () => undefined),
      findMarketMakingByOrderId: jest.fn(async () => ({
        orderId: 'o2',
        userId: 'u2',
      })),
    } as any;

    const paymentStateRepository = {
      findOne: jest.fn(async () => ({
        orderId: 'o2',
        userId: 'u2',
        baseAssetAmount: '1',
        quoteAssetAmount: '2',
        baseWithdrawalTxId: 'tx_base_2',
        quoteWithdrawalTxId: 'tx_quote_2',
      })),
      update: jest.fn(async () => ({ affected: 1 })),
    } as any;

    const mixinClientService = {
      client: {
        safe: {
          fetchSafeSnapshot: jest.fn(async () => ({
            confirmations: 1,
            transaction_hash: 'hash',
          })),
        },
      },
    } as any;

    const processor = new MarketMakingOrderProcessor(
      userOrdersService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mixinClientService,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn(() => true) } as any,
      paymentStateRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const job = createMockJob({
      orderId: 'o2',
      marketMakingPairId: 'pair2',
      // Intentionally missing baseWithdrawalTxId/quoteWithdrawalTxId
      startedAt: Date.now(),
      traceId: 't2',
    });

    job.queue.add = jest.fn(async () => undefined);

    await processor.handleMonitorMMWithdrawal(job);

    expect(
      mixinClientService.client.safe.fetchSafeSnapshot,
    ).toHaveBeenCalledTimes(2);
    expect(
      mixinClientService.client.safe.fetchSafeSnapshot,
    ).toHaveBeenCalledWith('tx_base_2');
    expect(
      mixinClientService.client.safe.fetchSafeSnapshot,
    ).toHaveBeenCalledWith('tx_quote_2');
  });
});
