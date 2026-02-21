import { findMatchingDeposit, normalizeCcxtDeposit } from './exchange-deposit-matcher';

describe('exchange-deposit-matcher', () => {
  it('normalizes common ccxt deposit fields', () => {
    const d = normalizeCcxtDeposit({
      currency: 'USDT',
      network: 'erc20',
      txid: '0xAbC',
      amount: '1.23',
      status: 'ok',
      timestamp: 1700000000000,
    });

    expect(d).toEqual(
      expect.objectContaining({
        currency: 'USDT',
        network: 'ERC20',
        txid: '0xabc',
        amount: '1.23',
        status: 'ok',
        timestamp: 1700000000000,
      }),
    );
  });

  it('matches by txid when expectedTxHash is provided (network/amount may be ignored)', () => {
    const deposits = [
      {
        currency: 'BTC',
        network: 'TRC20',
        txid: '0xbase',
        amount: '999',
        status: 'ok',
      },
    ];

    const found = findMatchingDeposit({
      deposits,
      symbol: 'BTC',
      network: 'ERC20',
      expectedAmount: '1',
      expectedTxHash: '0xbase',
      amountTolerance: '0.00000001',
    });

    expect(found).toBe(deposits[0]);
  });

  it('matches by currency+network+amount (case-insensitive network)', () => {
    const deposits = [
      {
        currency: 'USDT',
        info: { chain: 'erc20' },
        amount: '2',
        status: 'completed',
      },
    ];

    const found = findMatchingDeposit({
      deposits,
      symbol: 'USDT',
      network: 'ERC20',
      expectedAmount: '2.00000000',
      amountTolerance: '0.00000001',
    });

    expect(found).toBe(deposits[0]);
  });

  it('does not match when network is missing and no txid is provided', () => {
    const deposits = [
      {
        currency: 'USDT',
        amount: '2',
        status: 'ok',
      },
    ];

    const found = findMatchingDeposit({
      deposits,
      symbol: 'USDT',
      network: 'ERC20',
      expectedAmount: '2',
      amountTolerance: '0.00000001',
    });

    expect(found).toBeUndefined();
  });
});
