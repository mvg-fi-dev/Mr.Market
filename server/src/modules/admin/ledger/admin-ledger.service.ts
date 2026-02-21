import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LedgerEntry } from 'src/common/entities/ledger/ledger-entry.entity';
import { Repository } from 'typeorm';

import {
  ListLedgerEntriesQueryDto,
  ListLedgerEntriesResponseDto,
} from './admin-ledger.dto';

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;

  return Math.trunc(n);
}

@Injectable()
export class AdminLedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntryRepository: Repository<LedgerEntry>,
  ) {}

  async listLedgerEntries(
    query: ListLedgerEntriesQueryDto,
  ): Promise<ListLedgerEntriesResponseDto> {
    const limit = clampInt(query.limit, 1, 500, 50);

    const qb = this.ledgerEntryRepository
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.entryId', 'DESC')
      .limit(limit);

    if (query.userId) {
      qb.andWhere('e.userId = :userId', { userId: query.userId });
    }

    if (query.assetId) {
      qb.andWhere('e.assetId = :assetId', { assetId: query.assetId });
    }

    if (query.traceId) {
      qb.andWhere('e.traceId = :traceId', { traceId: query.traceId });
    }

    if (query.orderId) {
      qb.andWhere('e.orderId = :orderId', { orderId: query.orderId });
    }

    if (query.refType) {
      qb.andWhere('e.refType = :refType', { refType: query.refType });
    }

    if (query.refId) {
      qb.andWhere('e.refId = :refId', { refId: query.refId });
    }

    if (query.since) {
      qb.andWhere('e.createdAt >= :since', { since: query.since });
    }

    const rows = await qb.getMany();

    return {
      ok: true,
      entries: rows.map((e) => ({
        entryId: e.entryId,
        userId: e.userId,
        assetId: e.assetId,
        amount: e.amount,
        type: e.type,
        refType: e.refType,
        refId: e.refId,
        idempotencyKey: e.idempotencyKey,
        traceId: (e as any).traceId || '',
        orderId: (e as any).orderId || '',
        createdAt: e.createdAt,
      })),
    };
  }
}
