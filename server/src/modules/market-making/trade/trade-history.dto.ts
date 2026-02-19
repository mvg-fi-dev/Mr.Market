import { ApiProperty } from '@nestjs/swagger';

export class TradeHistoryItemDto {
  @ApiProperty({ example: 'binance' })
  exchange: string;

  @ApiProperty({ example: 'BTC/USDT' })
  symbol: string;

  @ApiProperty({ example: 'buy' })
  side: string;

  @ApiProperty({ example: 'limit' })
  type: string;

  @ApiProperty({ example: '0.1' })
  amount: string;

  @ApiProperty({ example: '45000' })
  price: string;

  @ApiProperty({ example: 'open' })
  status: string;

  @ApiProperty({ example: 'exchange-order-id-123' })
  orderId: string;

  @ApiProperty({ example: 'trade:client-123' })
  traceId: string;

  @ApiProperty({ example: '2026-02-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-19T02:00:05.000Z' })
  updatedAt: string;
}

export class TradeHistoryResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: 'order-1' })
  clientId: string;

  @ApiProperty({ type: [TradeHistoryItemDto] })
  trades: TradeHistoryItemDto[];
}
