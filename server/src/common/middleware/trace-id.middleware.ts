import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type TraceIdRequest = {
  traceId?: string;
  headers?: Record<string, unknown>;
};

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: TraceIdRequest, res: any, next: () => void) {
    const headerKey = 'x-trace-id';

    const headerVal =
      typeof req?.headers?.[headerKey] === 'string'
        ? String(req.headers[headerKey])
        : undefined;

    const traceId = headerVal && headerVal.trim().length
      ? headerVal.trim()
      : `http:${randomUUID()}`;

    req.traceId = traceId;

    try {
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('x-trace-id', traceId);
      }
    } catch {
      // ignore
    }

    next();
  }
}
