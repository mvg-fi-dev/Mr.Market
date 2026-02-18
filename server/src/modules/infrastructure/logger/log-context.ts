export type AuditLogContext = {
  traceId?: string;
  orderId?: string;
  job?: { id?: string | number; name?: string };
  exchange?: string;
  apiKeyId?: string;
};

/**
 * Formats a compact audit/log context prefix.
 *
 * NOTE: We intentionally use stable field names in output for grepping and auditing:
 * - traceId
 * - order_id
 * - job / job_id
 * - exchange
 * - api_key_id
 */
export function formatAuditLogContext(ctx: AuditLogContext): string {
  const parts: string[] = [];

  if (ctx.traceId) parts.push(`traceId=${ctx.traceId}`);
  if (ctx.orderId) parts.push(`order_id=${ctx.orderId}`);
  if (ctx.job?.name) parts.push(`job=${ctx.job.name}`);
  if (ctx.job?.id != null) parts.push(`job_id=${ctx.job.id}`);
  if (ctx.exchange) parts.push(`exchange=${ctx.exchange}`);
  if (ctx.apiKeyId) parts.push(`api_key_id=${ctx.apiKeyId}`);

  return parts.length ? `[${parts.join(' ')}]` : '';
}
