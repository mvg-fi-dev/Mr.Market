import { MMExchangeAllocationService } from './mm-exchange-allocation.service';

describe('MMExchangeAllocationService', () => {
  it('does not overwrite durable exit markers when params omit them', async () => {
    const repository = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    const service = new MMExchangeAllocationService(repository);

    await service.markExitWithdrawing({
      orderId: 'order-1',
      exitExpectedBaseTxHash: '0xbase',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { orderId: 'order-1' },
      expect.objectContaining({
        state: 'exit_withdrawing',
        exitExpectedBaseTxHash: '0xbase',
      }),
    );

    const patch = repository.update.mock.calls[0][1];
    expect(patch.exitExpectedQuoteTxHash).toBeUndefined();
    expect(patch.exitBaseIssuedAt).toBeUndefined();
    expect(patch.exitQuoteIssuedAt).toBeUndefined();
  });
});
