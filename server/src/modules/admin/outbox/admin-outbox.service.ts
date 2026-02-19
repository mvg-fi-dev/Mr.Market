import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEvent } from 'src/common/entities/system/outbox-event.entity';
import { Repository } from 'typeorm';

import {
  ListOutboxEventsQueryDto,
  ListOutboxEventsResponseDto,
} from './admin-outbox.dto';

@Injectable()
export class AdminOutboxService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {}

  async listOutboxEvents(
    query: ListOutboxEventsQueryDto,
  ): Promise<ListOutboxEventsResponseDto> {
    const limit = Number(query.limit || 50);

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

    // Best-effort grep inside JSON payload.
    // (SQLite) payload is TEXT so LIKE works.
    if (query.traceId) {
      qb.andWhere('e.payload LIKE :traceId', {
        traceId: `%"traceId":"${query.traceId}"%`,
      });
    }

    if (query.orderId) {
      qb.andWhere('e.payload LIKE :orderId', {
        orderId: `%"orderId":"${query.orderId}"%`,
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
        payload: e.payload,
        createdAt: e.createdAt,
      })),
    };
  }
}
