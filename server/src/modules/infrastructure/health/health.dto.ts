import { ApiProperty } from '@nestjs/swagger';

export class ExchangeHealthDto {
  @ApiProperty({ example: 'mexc' })
  name: string;

  @ApiProperty({ example: 'alive', enum: ['alive', 'dead'] })
  status: 'alive' | 'dead';
}

export class HealthSummaryDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: '2026-02-19T02:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: [ExchangeHealthDto] })
  exchanges: ExchangeHealthDto[];
}
