import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { ConsumerReceipt } from 'src/common/entities/system/consumer-receipt.entity';
import { OutboxEvent } from 'src/common/entities/system/outbox-event.entity';
import { getRFC3339Timestamp } from 'src/common/helpers/utils';
import { Repository } from 'typeorm';

type AppendOutboxCommand = {
  topic: string;
  aggregateType: string;
  aggregateId: string;
  /**
   * Optional extracted fields for indexing/search.
   * (If omitted, we will best-effort extract from payload.)
   */
  traceId?: string;
  orderId?: string;
  payload: Record<string, unknown>;
};

export type ListOutboxEventsQuery = {
  topics?: string[];
  aggregateType?: string;
  aggregateId?: string;
  since?: string;
  traceId?: string;
  orderId?: string;
  limit?: number;
};

@Injectable()
export class DurabilityService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    @InjectRepository(ConsumerReceipt)
    private readonly consumerReceiptRepository: Repository<ConsumerReceipt>,
  ) {}

  async listOutboxEvents(query: ListOutboxEventsQuery): Promise<OutboxEvent[]> {
    const limit = Math.max(1, Math.min(1000, Number(query.limit || 50)));

    const qb = this.outboxRepository
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.eventId', 'DESC')
      .limit(limit);

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

    if (query.traceId) {
      qb.andWhere('e.traceId = :traceId', { traceId: query.traceId });
    }

    if (query.orderId) {
      qb.andWhere('e.orderId = :orderId', { orderId: query.orderId });
    }

    if (query.topics && query.topics.length > 0) {
      qb.andWhere('e.topic IN (:...topics)', { topics: query.topics });
    }

    return await qb.getMany();
  }

  async appendOutboxEvent(command: AppendOutboxCommand): Promise<OutboxEvent> {
    const payloadTraceId = this.extractString(command.payload?.traceId);
    const payloadOrderId = this.extractString(command.payload?.orderId);

    const event = this.outboxRepository.create({
      eventId: randomUUID(),
      topic: command.topic,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      traceId: command.traceId || payloadTraceId || '',
      orderId: command.orderId || payloadOrderId || '',
      payload: JSON.stringify(command.payload),
      createdAt: getRFC3339Timestamp(),
    });

    return await this.outboxRepository.save(event);
  }

  async markProcessed(
    consumerName: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    const receipt = this.consumerReceiptRepository.create({
      receiptId: randomUUID(),
      consumerName,
      idempotencyKey,
      status: 'processed',
      processedAt: getRFC3339Timestamp(),
    });

    try {
      if (
        typeof (this.consumerReceiptRepository as any).insert === 'function'
      ) {
        await (this.consumerReceiptRepository as any).insert(receipt);
      } else {
        const existing = await this.consumerReceiptRepository.findOneBy({
          consumerName,
          idempotencyKey,
        });

        if (existing) {
          return false;
        }
        await this.consumerReceiptRepository.save(receipt);
      }

      return true;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async isProcessed(
    consumerName: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    const existing = await this.consumerReceiptRepository.findOneBy({
      consumerName,
      idempotencyKey,
    });

    return Boolean(existing);
  }

  private extractString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const v = value.trim();

    return v.length ? v : undefined;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const code = (error as { code?: string }).code;
    const message = String((error as { message?: string }).message || '');

    return code === '23505' || message.toLowerCase().includes('duplicate');
  }
}
