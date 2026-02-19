import { describe, expect, it } from 'vitest';

import {
  getMarketMakingFlowKey,
  getMarketMakingFlowSteps,
  getMarketMakingStateDisplay,
  isMarketMakingTerminalState,
} from './marketMakingState';

describe('marketMakingState', () => {
  it('maps payment states to payment step', () => {
    expect(getMarketMakingFlowKey('payment_pending')).toBe('payment');
    expect(getMarketMakingFlowKey('payment_incomplete')).toBe('payment');
    expect(getMarketMakingFlowKey('payment_complete')).toBe('payment');
  });

  it('maps withdraw states to withdraw step', () => {
    expect(getMarketMakingFlowKey('withdrawing')).toBe('withdraw');
    expect(getMarketMakingFlowKey('withdrawal_confirmed')).toBe('withdraw');
  });

  it('maps deposit states to deposit step', () => {
    expect(getMarketMakingFlowKey('deposit_confirming')).toBe('deposit');
    expect(getMarketMakingFlowKey('deposit_confirmed')).toBe('deposit');
  });

  it('maps running to running step', () => {
    expect(getMarketMakingFlowKey('running')).toBe('running');
  });

  it('computes step completion', () => {
    const steps = getMarketMakingFlowSteps('deposit_confirming');
    expect(steps.find((s) => s.key === 'payment')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'withdraw')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'deposit')?.active).toBe(true);
  });

  it('terminal state detection', () => {
    expect(isMarketMakingTerminalState('running')).toBe(true);
    expect(isMarketMakingTerminalState('failed')).toBe(true);
    expect(isMarketMakingTerminalState('refunded')).toBe(true);
    expect(isMarketMakingTerminalState('payment_pending')).toBe(false);
  });

  it('display has stable tone and label', () => {
    const d = getMarketMakingStateDisplay('failed');
    expect(d.tone).toBe('error');
    expect(d.label.toLowerCase()).toContain('failed');
  });
});
