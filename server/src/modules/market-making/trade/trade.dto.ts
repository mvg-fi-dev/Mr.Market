import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class MarketTradeDto {
  @ApiProperty({ description: 'Identifier for the sub-user' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Identifier for the client' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

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
