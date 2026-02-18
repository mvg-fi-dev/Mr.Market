export type AuditLogContext = {
  traceId?: string;
  campaignId?: string;
  orderId?: string;
  job?: { id?: string | number; name?: string };
  chainId?: string | number;
  exchange?: string;
  apiKeyId?: string;
  version?: string;
};

/**
 * Formats a compact audit/log context prefix.
 *
 * NOTE: We intentionally use stable field names in output for grepping and auditing:
 * - traceId
 * - campaign_id
 * - order_id
 * - job / job_id
 * - chain_id
 * - exchange
 * - api_key_id
 * - version
 */
export function formatAuditLogContext(ctx: AuditLogContext): string {
  const parts: string[] = [];

  if (ctx.traceId) parts.push(`traceId=${ctx.traceId}`);
  if (ctx.campaignId) parts.push(`campaign_id=${ctx.campaignId}`);
  if (ctx.orderId) parts.push(`order_id=${ctx.orderId}`);
  if (ctx.job?.name) parts.push(`job=${ctx.job.name}`);
  if (ctx.job?.id != null) parts.push(`job_id=${ctx.job.id}`);
  if (ctx.chainId != null) parts.push(`chain_id=${ctx.chainId}`);
  if (ctx.exchange) parts.push(`exchange=${ctx.exchange}`);
  if (ctx.apiKeyId) parts.push(`api_key_id=${ctx.apiKeyId}`);
  if (ctx.version) parts.push(`version=${ctx.version}`);

  return parts.length ? `[${parts.join(' ')}]` : '';
}
