import BigNumber from 'bignumber.js';

export type NormalizedDeposit = {
  currency?: string;
  network?: string;
  txid?: string;
  amount?: string;
  status?: string;
  timestamp?: number;
};

/**
 * Canonicalize network strings across exchanges.
 *
 * Why: ccxt adapters often report network as 'ETH'/'Ethereum' for ERC20, etc.
 * We want stable matching based on the MM's expected ccxt network identifier.
 */
export function canonicalizeNetwork(network: string | undefined): string | undefined {
  if (!network) return undefined;
  const v = String(network).trim().toUpperCase();
  if (!v.length) return undefined;

  const aliasToCanonical: Record<string, string> = {
    // Ethereum
    ETH: 'ERC20',
    ETHEREUM: 'ERC20',
    ERC20: 'ERC20',

    // Tron
    TRON: 'TRC20',
    TRX: 'TRC20',
    TRC20: 'TRC20',

    // Binance Smart Chain
    BSC: 'BEP20',
    BNB: 'BEP20',
    BEP20: 'BEP20',

    // Polygon
    POLYGON: 'MATIC',
    MATIC: 'MATIC',

    // Solana
    SOLANA: 'SOL',
    SOL: 'SOL',

    // Avalanche C-Chain
    AVALANCHE: 'AVAXC',
    AVAX: 'AVAXC',
    AVAXC: 'AVAXC',

    // Native chains commonly used as-is
    BTC: 'BTC',
    LTC: 'LTC',
    DOGE: 'DOGE',
    XRP: 'XRP',
  };

  return aliasToCanonical[v] || v;
}

function toUpperSafe(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const v = String(value).trim();
  if (!v.length) return undefined;
  return v.toUpperCase();
}

function toLowerSafe(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const v = String(value).trim();
  if (!v.length) return undefined;
  return v.toLowerCase();
}

function toBnString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    const bn = new BigNumber(value);
    return bn.isFinite() ? bn.toFixed() : undefined;
  }

  if (typeof value === 'string') {
    const v = value.trim();
    if (!v.length) return undefined;

    const bn = new BigNumber(v);
    return bn.isFinite() ? bn.toFixed() : undefined;
  }

  return undefined;
}

function toTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return value;
  }

  if (typeof value === 'string') {
    const v = value.trim();
    if (!v.length) return undefined;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : undefined;
  }

  return undefined;
}

/**
 * Normalize a ccxt deposit record into a small stable shape.
 * ccxt exchange adapters vary wildly; we use best-effort extraction.
 */
export function normalizeCcxtDeposit(record: any): NormalizedDeposit {
  const info = record?.info || {};

  const currency =
    toUpperSafe(record?.currency) ||
    toUpperSafe(record?.code) ||
    toUpperSafe(record?.symbol) ||
    toUpperSafe(info?.currency) ||
    toUpperSafe(info?.coin) ||
    toUpperSafe(info?.asset);

  // `network` can live in multiple places; some exchanges return chain names.
  const network =
    toUpperSafe(record?.network) ||
    toUpperSafe(info?.network) ||
    toUpperSafe(info?.chain) ||
    toUpperSafe(info?.chainName) ||
    toUpperSafe(info?.chainType);

  const txid =
    toLowerSafe(record?.txid) ||
    toLowerSafe(record?.txId) ||
    toLowerSafe(record?.txHash) ||
    toLowerSafe(record?.hash) ||
    toLowerSafe(info?.txid) ||
    toLowerSafe(info?.txId) ||
    toLowerSafe(info?.txHash) ||
    toLowerSafe(info?.hash);

  const amount =
    toBnString(record?.amount) ||
    toBnString(record?.quantity) ||
    toBnString(record?.value) ||
    toBnString(info?.amount) ||
    toBnString(info?.qty);

  const status =
    toLowerSafe(record?.status) ||
    toLowerSafe(info?.status) ||
    toLowerSafe(info?.state);

  const timestamp =
    toTimestamp(record?.timestamp) ||
    toTimestamp(record?.datetime) ||
    toTimestamp(info?.insertTime) ||
    toTimestamp(info?.createdAt) ||
    toTimestamp(info?.time);

  return { currency, network, txid, amount, status, timestamp };
}

export function isDepositConfirmedStatus(status: string | undefined): boolean {
  const v = (status || '').toLowerCase();
  if (!v.length) {
    // Many exchanges omit status in deposits; treat as unknown (not blocking) for now.
    return true;
  }

  // Common ccxt/exchange values.
  if (
    v === 'ok' ||
    v === 'success' ||
    v === 'succeeded' ||
    v === 'completed' ||
    v === 'complete' ||
    v === 'confirmed'
  ) {
    return true;
  }

  // Explicit negatives.
  if (v === 'failed' || v === 'rejected' || v === 'canceled' || v === 'cancelled') {
    return false;
  }

  // Pending-ish.
  if (v === 'pending' || v === 'processing') {
    return false;
  }

  // Unknown status: be conservative? For now, treat unknown as true to avoid false negatives,
  // because we also require txid or amount+network match.
  return true;
}

export function findMatchingDeposit(args: {
  deposits: any[];
  symbol: string;
  network: string;
  expectedAmount: string;
  expectedTxHash?: string;
  amountTolerance: string | BigNumber;
}): any | undefined {
  const expectedSymbol = toUpperSafe(args.symbol);
  const expectedNetwork = canonicalizeNetwork(toUpperSafe(args.network));
  const expectedTx = toLowerSafe(args.expectedTxHash);
  const expectedAmountBn = new BigNumber(args.expectedAmount || '0');
  const toleranceBn =
    args.amountTolerance instanceof BigNumber ?
      args.amountTolerance
    : new BigNumber(args.amountTolerance || '0');

  return (args.deposits || []).find((raw) => {
    const d = normalizeCcxtDeposit(raw);

    if (!expectedSymbol || !expectedNetwork) return false;

    if (!d.currency || d.currency !== expectedSymbol) {
      return false;
    }

    if (!isDepositConfirmedStatus(d.status)) {
      return false;
    }

    // If we have an expected tx hash from Mixin, prefer strict match.
    if (expectedTx) {
      if (!d.txid) return false;
      return d.txid === expectedTx;
    }

    // Network match (case-insensitive + alias normalization).
    // If deposit omits network, we cannot safely match by amount only.
    const depositNetwork = canonicalizeNetwork(d.network);

    if (!depositNetwork || depositNetwork !== expectedNetwork) {
      return false;
    }

    if (!d.amount) {
      return false;
    }

    const amountBn = new BigNumber(d.amount);
    if (!amountBn.isFinite() || amountBn.isLessThanOrEqualTo(0)) {
      return false;
    }

    if (!expectedAmountBn.isFinite() || expectedAmountBn.isLessThanOrEqualTo(0)) {
      return false;
    }

    const delta = amountBn.minus(expectedAmountBn).abs();
    return delta.isLessThanOrEqualTo(toleranceBn);
  });
}
