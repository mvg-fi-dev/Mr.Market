import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class MarketTradeDto {
  @ApiProperty({ description: 'Identifier for the sub-user' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Identifier for the client' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Correlation id for auditability/replayability',
    required: false,
  })
  @IsString()
  @IsOptional()
  traceId?: string;

  @ApiProperty({ description: 'Exchange' })
  @IsString()
  @IsNotEmpty()
  exchange: string;

  @ApiProperty({ description: 'Symbol for the trade (e.g., BTC/USD)' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'Side of the trade (buy or sell)',
    enum: ['buy', 'sell'],
  })
  @IsString()
  @IsNotEmpty()
  side: string;

  @ApiProperty({ description: 'Amount to trade' })
  @IsNumber()
  amount: number;
}

export class LimitTradeDto {
  @ApiProperty({ description: 'Identifier for the sub-user' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Identifier for the client' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Correlation id for auditability/replayability',
    required: false,
  })
  @IsString()
  @IsOptional()
  traceId?: string;

  @ApiProperty({ description: 'Exchange' })
  @IsString()
  @IsNotEmpty()
  exchange: string;

  @ApiProperty({ description: 'Symbol for the trade (e.g., BTC/USD)' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'Side of the trade (buy or sell)',
    enum: ['buy', 'sell'],
  })
  @IsString()
  @IsNotEmpty()
  side: string;

  @ApiProperty({ description: 'Amount to trade' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Price at which the trade should be executed' })
  @IsNumber()
  price: number;
}

export class CancelTradeDto {
  @ApiProperty({ description: 'Exchange' })
  @IsString()
  @IsNotEmpty()
  exchange: string;

  @ApiProperty({ description: 'Exchange order id' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Symbol (e.g., BTC/USDT)' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'Correlation id for auditability/replayability',
    required: false,
  })
  @IsString()
  @IsOptional()
  traceId?: string;

  @ApiProperty({ description: 'Identifier for the sub-user', required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Identifier for the client', required: false })
  @IsString()
  @IsOptional()
  clientId?: string;
}
