import * as ccxt from 'ccxt';

export type TradeErrorClassification = {
  /** Stable error code for auditing/replayability dashboards. */
  errorCode: string;
  /** If true, callers/workers may safely retry (idempotency still required). */
  retryable: boolean;
  /** High-level bucket for ops dashboards. */
  category: 'NETWORK' | 'RATE_LIMIT' | 'EXCHANGE' | 'VALIDATION' | 'UNKNOWN';
  /** Best-effort source error name (class name / error.name). */
  errorName: string;
  /** Best-effort source error message (sanitized/truncated). */
  errorMessage: string;
};

function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;

  return `${input.slice(0, maxLen)}…`;
}

function safeErrorName(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'UnknownError';
  }

  const anyErr = error as any;
  return String(anyErr?.constructor?.name || anyErr?.name || 'UnknownError');
}

function safeErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const anyErr = error as any;
  const raw = String(anyErr?.message || '');

  // Avoid huge/secret-leaking payloads in outbox events.
  return truncate(raw, 500);
}

/**
 * ccxt error taxonomy v0.
 *
 * Goals:
 * - produce stable, greppable error codes (auditability)
 * - mark retryability for workers (safety)
 *
 * NOTE: We cannot rely purely on instanceof in tests/runtime because ccxt may be bundled/mocked.
 */
export function classifyCcxtError(error: unknown): TradeErrorClassification {
  const errorName = safeErrorName(error);
  const errorMessage = safeErrorMessage(error);

  const C: any = ccxt as any;
  const isInstanceOf = (klass: any) =>
    Boolean(klass && error instanceof klass);

  const name = errorName;

  // Rate limiting / protection (retryable with backoff)
  // NOTE: some ccxt rate-limit errors may inherit from NetworkError, so check this FIRST.
  if (
    isInstanceOf(C.DDoSProtection) ||
    isInstanceOf(C.RateLimitExceeded) ||
    ['DDoSProtection', 'RateLimitExceeded'].includes(name)
  ) {
    return {
      errorCode: 'EXCHANGE_RATE_LIMITED',
      retryable: true,
      category: 'RATE_LIMIT',
      errorName,
      errorMessage,
    };
  }

  // Network-ish (retryable)
  if (
    isInstanceOf(C.NetworkError) ||
    ['NetworkError', 'RequestTimeout', 'ExchangeNotAvailable'].includes(name)
  ) {
    return {
      errorCode: 'EXCHANGE_NETWORK_ERROR',
      retryable: true,
      category: 'NETWORK',
      errorName,
      errorMessage,
    };
  }

  // Validation-ish (non-retryable in most cases)
  if (
    isInstanceOf(C.InvalidOrder) ||
    isInstanceOf(C.BadRequest) ||
    isInstanceOf(C.InvalidAddress) ||
    ['InvalidOrder', 'BadRequest', 'InvalidAddress'].includes(name)
  ) {
    return {
      errorCode: 'EXCHANGE_INVALID_REQUEST',
      retryable: false,
      category: 'VALIDATION',
      errorName,
      errorMessage,
    };
  }

  if (
    isInstanceOf(C.InsufficientFunds) ||
    ['InsufficientFunds'].includes(name)
  ) {
    return {
      errorCode: 'EXCHANGE_INSUFFICIENT_FUNDS',
      retryable: false,
      category: 'EXCHANGE',
      errorName,
      errorMessage,
    };
  }

  // Generic exchange error (often non-retryable, but depends)
  if (isInstanceOf(C.ExchangeError) || ['ExchangeError'].includes(name)) {
    return {
      errorCode: 'EXCHANGE_ERROR',
      retryable: false,
      category: 'EXCHANGE',
      errorName,
      errorMessage,
    };
  }

  return {
    errorCode: 'UNKNOWN',
    retryable: false,
    category: 'UNKNOWN',
    errorName,
    errorMessage,
  };
}
