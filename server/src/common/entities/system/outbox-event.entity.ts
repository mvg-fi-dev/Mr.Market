/**
 * Persists outbound domain events for durable outbox processing.
 * Used by app.module and modules/market-making/durability service/module/specs.
 */
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class OutboxEvent {
  @PrimaryColumn()
  eventId: string;

  @Column()
  @Index()
  topic: string;

  @Column()
  @Index()
  aggregateType: string;

  @Column()
  @Index()
  aggregateId: string;

  /**
   * First-class fields for auditability/replayability.
   *
   * NOTE:
   * - These duplicate values in payload for indexing/search (avoid SQL LIKE on JSON TEXT).
   * - Default '' is used for backward compatibility and to keep INSERTs simple.
   */
  @Column({ default: '' })
  @Index()
  traceId: string;

  @Column({ default: '' })
  @Index()
  orderId: string;

  @Column({ type: 'text' })
  payload: string;

  @Column()
  createdAt: string;
}
