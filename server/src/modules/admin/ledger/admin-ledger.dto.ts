import { ApiProperty } from '@nestjs/swagger';

export class ListLedgerEntriesQueryDto {
  @ApiProperty({ required: false, description: 'Filter by userId' })
  userId?: string;

  @ApiProperty({ required: false, description: 'Filter by assetId' })
  assetId?: string;

  @ApiProperty({ required: false, description: 'Filter by traceId' })
  traceId?: string;

  @ApiProperty({ required: false, description: 'Filter by orderId (MM order id)' })
  orderId?: string;

  @ApiProperty({ required: false, description: 'Filter by refType' })
  refType?: string;

  @ApiProperty({ required: false, description: 'Filter by refId' })
  refId?: string;

  @ApiProperty({ required: false, description: 'Only include entries created at/after this RFC3339 timestamp' })
  since?: string;

  @ApiProperty({ required: false, description: 'Max rows (1-500, default 50)' })
  limit?: number;
}

export class LedgerEntryDto {
  @ApiProperty()
  entryId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  assetId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ required: false })
  refType?: string;

  @ApiProperty({ required: false })
  refId?: string;

  @ApiProperty()
  idempotencyKey: string;

  @ApiProperty()
  traceId: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  createdAt: string;
}

export class ListLedgerEntriesResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty({ type: [LedgerEntryDto] })
  entries: LedgerEntryDto[];
}
