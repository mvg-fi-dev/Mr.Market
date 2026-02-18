import { formatAuditLogContext } from './log-context';

describe('formatAuditLogContext', () => {
  it('formats stable audit fields', () => {
    const out = formatAuditLogContext({
      traceId: 't1',
      campaignId: 'c1',
      orderId: 'o1',
      chainId: 1,
      exchange: 'mexc',
      apiKeyId: 'k1',
      version: '1.2.3',
      job: { id: 123, name: 'withdraw_to_exchange' },
    });

    expect(out).toBe(
      '[traceId=t1 campaign_id=c1 order_id=o1 job=withdraw_to_exchange job_id=123 chain_id=1 exchange=mexc api_key_id=k1 version=1.2.3]',
    );
  });

  it('returns empty string when nothing provided', () => {
    expect(formatAuditLogContext({})).toBe('');
  });

  it('skips undefined optional fields', () => {
    const out = formatAuditLogContext({
      traceId: 't1',
      job: { id: 0, name: '' },
      chainId: 0,
    });

    // job name empty -> omitted; job_id=0 -> included; chain_id=0 -> included
    expect(out).toBe('[traceId=t1 job_id=0 chain_id=0]');
  });
});
