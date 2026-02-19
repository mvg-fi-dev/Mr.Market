import * as ccxt from 'ccxt';

import { classifyCcxtError } from './trade-error-taxonomy';

describe('classifyCcxtError', () => {
  it('classifies NetworkError as retryable network error', () => {
    const err = new (ccxt as any).NetworkError('timeout');
    const c = classifyCcxtError(err);

    expect(c.errorCode).toBe('EXCHANGE_NETWORK_ERROR');
    expect(c.retryable).toBe(true);
    expect(c.category).toBe('NETWORK');
  });

  it('classifies RateLimitExceeded as retryable rate limit error', () => {
    const err = new (ccxt as any).RateLimitExceeded('429');
    const c = classifyCcxtError(err);

    expect(c.errorCode).toBe('EXCHANGE_RATE_LIMITED');
    expect(c.retryable).toBe(true);
    expect(c.category).toBe('RATE_LIMIT');
  });

  it('classifies InsufficientFunds as non-retryable exchange error', () => {
    const err = new (ccxt as any).InsufficientFunds('no balance');
    const c = classifyCcxtError(err);

    expect(c.errorCode).toBe('EXCHANGE_INSUFFICIENT_FUNDS');
    expect(c.retryable).toBe(false);
    expect(c.category).toBe('EXCHANGE');
  });

  it('classifies unknown error as UNKNOWN', () => {
    const err = new Error('boom');
    const c = classifyCcxtError(err);

    expect(c.errorCode).toBe('UNKNOWN');
    expect(c.retryable).toBe(false);
    expect(c.category).toBe('UNKNOWN');
  });
});
