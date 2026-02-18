import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';

function containsKey(value: unknown, key: string, depth = 0): boolean {
  if (depth > 4) return false;
  if (!value) return false;

  if (Array.isArray(value)) {
    // Limit recursion cost on large arrays.
    const max = Math.min(value.length, 50);
    for (let i = 0; i < max; i++) {
      if (containsKey(value[i], key, depth + 1)) return true;
    }
    return false;
  }

  if (typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return true;

  // Limit recursion cost on large objects.
  const keys = Object.keys(obj);
  const max = Math.min(keys.length, 50);
  for (let i = 0; i < max; i++) {
    const k = keys[i];
    if (containsKey(obj[k], key, depth + 1)) return true;
  }

  return false;
}

@Catch(BadRequestException)
export class ValidationAuditFilter implements ExceptionFilter {
  private readonly logger = new CustomLogger(ValidationAuditFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    // Audit log: attempts to pass sensitive or internal-only fields through external HTTP bodies.
    // Note: this filter only runs after a BadRequestException (e.g. ValidationPipe forbidNonWhitelisted).
    try {
      const auditKeys = ['apiKeyId', 'api_key', 'api_secret', 'apiKey', 'apiSecret'] as const;
      const found: string[] = [];

      for (const key of auditKeys) {
        if (containsKey(req?.body, key)) found.push(key);
      }

      if (found.length) {
        this.logger.warn(
          `AUDIT: rejected request containing disallowed keys in body: keys=${found.join(',')} ${req?.method} ${req?.url}`,
        );
      }
    } catch (e) {
      // Never block the response on logging issues.
      this.logger.error(`Validation audit logging failed: ${e?.message}`);
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return res.status(status).json({ statusCode: status, message: payload });
    }

    return res.status(status).json(payload);
  }
}
