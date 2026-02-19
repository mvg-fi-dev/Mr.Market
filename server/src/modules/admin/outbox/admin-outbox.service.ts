import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEvent } from 'src/common/entities/system/outbox-event.entity';
import { Repository } from 'typeorm';

import {
  ListOutboxEventsQueryDto,
  ListOutboxEventsResponseDto,
} from './admin-outbox.dto';

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const n = Number(value);

  // If input is missing/invalid, use fallback.
  if (!Number.isFinite(n)) return fallback;

  // If input is explicitly out-of-range, clamp (do not fallback).
  if (n < min) return min;
  if (n > max) return max;

  return Math.trunc(n);
}

function buildContainsLikePattern(input: string): string {
  // Best-effort substring search. This is an ops/audit endpoint; precision is not guaranteed.
  // NOTE: We intentionally do not attempt cross-dialect escaping here.
  return `%${input}%`;
}

@Injectable()
export class AdminOutboxService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {}

  async listOutboxEvents(
    query: ListOutboxEventsQueryDto,
  ): Promise<ListOutboxEventsResponseDto> {
    const limit = clampInt(query.limit, 1, 500, 50);

    const qb = this.outboxRepository
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.eventId', 'DESC')
      .limit(limit);

    if (query.topic) {
      qb.andWhere('e.topic = :topic', { topic: query.topic });
    }

    if (query.aggregateType) {
      qb.andWhere('e.aggregateType = :aggregateType', {
        aggregateType: query.aggregateType,
      });
    }

    if (query.aggregateId) {
      qb.andWhere('e.aggregateId = :aggregateId', {
        aggregateId: query.aggregateId,
      });
    }

    if (query.since) {
      qb.andWhere('e.createdAt >= :since', { since: query.since });
    }

    // Prefer indexed first-class fields when available.
    // Fallback to best-effort payload substring search for legacy rows where traceId/orderId were not extracted.
    if (query.traceId) {
      qb.andWhere('(e.traceId = :traceId OR e.payload LIKE :traceLike)', {
        traceId: query.traceId,
        traceLike: buildContainsLikePattern(query.traceId),
      });
    }

    if (query.orderId) {
      qb.andWhere('(e.orderId = :orderId OR e.payload LIKE :orderLike)', {
        orderId: query.orderId,
        orderLike: buildContainsLikePattern(query.orderId),
      });
    }

    const events = await qb.getMany();

    return {
      ok: true,
      events: events.map((e) => ({
        eventId: e.eventId,
        topic: e.topic,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        traceId: (e as any).traceId || '',
        orderId: (e as any).orderId || '',
        payload: e.payload,
        createdAt: e.createdAt,
      })),
    };
  }
}
