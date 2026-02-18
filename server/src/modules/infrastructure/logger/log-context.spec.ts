import { formatAuditLogContext } from './log-context';

describe('formatAuditLogContext', () => {
  it('formats stable audit fields', () => {
    const out = formatAuditLogContext({
      traceId: 't1',
      orderId: 'o1',
      exchange: 'mexc',
      apiKeyId: 'k1',
      job: { id: 123, name: 'withdraw_to_exchange' },
    });

    expect(out).toBe(
      '[traceId=t1 order_id=o1 job=withdraw_to_exchange job_id=123 exchange=mexc api_key_id=k1]',
    );
  });

  it('returns empty string when nothing provided', () => {
    expect(formatAuditLogContext({})).toBe('');
  });
});
