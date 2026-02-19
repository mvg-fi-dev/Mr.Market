import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListOutboxEventsQueryDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  aggregateType?: string;

  @IsOptional()
  @IsString()
  aggregateId?: string;

  /**
   * Best-effort substring search inside JSON payload.
   * NOTE: implemented via SQL LIKE; meant for ops/audit, not as a public search API.
   */
  @IsOptional()
  @IsString()
  traceId?: string;

  /**
   * Best-effort substring search inside JSON payload.
   */
  @IsOptional()
  @IsString()
  orderId?: string;

  /**
   * RFC3339/ISO8601 lower bound on createdAt (string compare).
   * Example: 2026-02-19T00:00:00.000Z
   */
  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export type OutboxEventDto = {
  eventId: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  traceId: string;
  orderId: string;
  payload: string;
  createdAt: string;
};

export class ListOutboxEventsResponseDto {
  ok: boolean;
  events: OutboxEventDto[];
}
