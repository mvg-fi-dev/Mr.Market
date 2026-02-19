export type MarketMakingState =
  | 'payment_pending'
  | 'payment_incomplete'
  | 'payment_complete'
  | 'withdrawing'
  | 'withdrawal_confirmed'
  | 'deposit_confirming'
  | 'deposit_confirmed'
  | 'joining_campaign'
  | 'campaign_joined'
  | 'created'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'exit_requested'
  | 'exit_withdrawing'
  | 'exit_refunding'
  | 'exit_complete'
  | 'failed'
  | 'refunded'
  | 'deleted'
  | (string & Record<string, never>);

export type MarketMakingFlowStepKey = 'payment' | 'withdraw' | 'deposit' | 'running';

export type MarketMakingFlowStep = {
  key: MarketMakingFlowStepKey;
  title: string;
  done: boolean;
  active: boolean;
};

const stepOrder: MarketMakingFlowStepKey[] = [
  'payment',
  'withdraw',
  'deposit',
  'running',
];

export const isMarketMakingTerminalState = (state?: MarketMakingState | null) => {
  if (!state) return false;
  return (
    state === 'running' ||
    state === 'failed' ||
    state === 'refunded' ||
    state === 'deleted' ||
    state === 'stopped' ||
    state === 'paused' ||
    state === 'exit_complete'
  );
};

export const getMarketMakingFlowKey = (
  state?: MarketMakingState | null,
): MarketMakingFlowStepKey => {
  switch (state) {
    case 'payment_pending':
    case 'payment_incomplete':
    case 'payment_complete':
      return 'payment';

    case 'withdrawing':
    case 'withdrawal_confirmed':
      return 'withdraw';

    case 'deposit_confirming':
    case 'deposit_confirmed':
      return 'deposit';

    case 'running':
      return 'running';

    default:
      // For unknown/intermediate states, default to payment step (safe).
      return 'payment';
  }
};

export const getMarketMakingStateDisplay = (
  state?: MarketMakingState | null,
): { label: string; hint: string; tone: 'info' | 'success' | 'warning' | 'error' } => {
  switch (state) {
    case 'payment_pending':
      return {
        label: 'Waiting for payment',
        hint: 'Open the payment link and complete base/quote + fees.',
        tone: 'info',
      };
    case 'payment_incomplete':
      return {
        label: 'Payment incomplete',
        hint: 'We received a partial payment. Please complete the remaining items.',
        tone: 'warning',
      };
    case 'payment_complete':
      return {
        label: 'Payment complete',
        hint: 'Preparing withdrawal to exchange…',
        tone: 'info',
      };

    case 'withdrawing':
      return {
        label: 'Withdrawing to exchange',
        hint: 'Transferring funds from Mixin to the exchange…',
        tone: 'info',
      };
    case 'withdrawal_confirmed':
      return {
        label: 'Withdrawal confirmed',
        hint: 'Waiting for exchange deposit confirmation…',
        tone: 'info',
      };

    case 'deposit_confirming':
      return {
        label: 'Confirming exchange deposit',
        hint: 'Polling exchange deposit records until both legs are confirmed…',
        tone: 'info',
      };
    case 'deposit_confirmed':
      return {
        label: 'Exchange deposit confirmed',
        hint: 'Starting market making…',
        tone: 'info',
      };

    case 'running':
      return {
        label: 'Running',
        hint: 'Market making is active.',
        tone: 'success',
      };

    case 'paused':
      return {
        label: 'Paused',
        hint: 'Strategy execution is paused. You can resume later.',
        tone: 'warning',
      };
    case 'stopped':
      return {
        label: 'Stopped',
        hint: 'Strategy has been stopped.',
        tone: 'warning',
      };

    case 'exit_requested':
    case 'exit_withdrawing':
    case 'exit_refunding':
      return {
        label: 'Exiting',
        hint: 'Stopping and withdrawing funds back to Mixin…',
        tone: 'warning',
      };
    case 'exit_complete':
      return {
        label: 'Exit complete',
        hint: 'Funds have been returned to your wallet.',
        tone: 'success',
      };

    case 'failed':
      return {
        label: 'Failed',
        hint: 'The order failed during processing. Check details or contact support.',
        tone: 'error',
      };
    case 'refunded':
      return {
        label: 'Refunded',
        hint: 'Funds have been refunded to your wallet.',
        tone: 'warning',
      };

    default:
      return {
        label: state ? `State: ${state}` : 'Unknown state',
        hint: 'Refresh to get the latest status.',
        tone: 'info',
      };
  }
};

export const getMarketMakingFlowSteps = (
  state?: MarketMakingState | null,
): MarketMakingFlowStep[] => {
  const activeKey = getMarketMakingFlowKey(state);

  const doneKeys = new Set<MarketMakingFlowStepKey>();
  if (state === 'payment_complete' || state === 'withdrawing' || state === 'withdrawal_confirmed' || state === 'deposit_confirming' || state === 'deposit_confirmed' || state === 'running') {
    doneKeys.add('payment');
  }
  if (state === 'withdrawal_confirmed' || state === 'deposit_confirming' || state === 'deposit_confirmed' || state === 'running') {
    doneKeys.add('withdraw');
  }
  if (state === 'deposit_confirmed' || state === 'running') {
    doneKeys.add('deposit');
  }
  if (state === 'running') {
    doneKeys.add('running');
  }

  return stepOrder.map((key) => ({
    key,
    title:
      key === 'payment'
        ? 'Payment'
        : key === 'withdraw'
          ? 'Withdraw'
          : key === 'deposit'
            ? 'Deposit'
            : 'Running',
    done: doneKeys.has(key),
    active: key === activeKey,
  }));
};
