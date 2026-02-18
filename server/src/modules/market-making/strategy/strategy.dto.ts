// strategy.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PriceSourceType } from 'src/common/enum/pricesourcetype';

export class JoinStrategyDto {
  @ApiProperty({ description: 'User ID', example: 'user123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Client ID', example: 'client123' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Strategy Key',
    example: 'user123-client123-arbitrage',
  })
  @IsString()
  @IsNotEmpty()
  strategyKey: string;

  @ApiProperty({ description: 'Amount contributed', example: 100.0 })
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Transaction Hash', example: '0xabc123...' })
  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @ApiProperty({ description: 'Token Symbol', example: 'USDT' })
  @IsString()
  @IsNotEmpty()
  tokenSymbol: string;

  @ApiProperty({ description: 'Chain ID', example: 1 })
  @Type(() => Number)
  @IsNumber()
  chainId: number;

  @ApiProperty({
    description: 'Token Contract Address',
    example: '0xabc123...',
  })
  @IsString()
  @IsNotEmpty()
  tokenAddress: string;
}

export class ArbitrageStrategyDto {
  @ApiProperty({
    example: '123',
    description: 'User ID for whom the strategy is being executed.',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: '456',
    description: 'Client ID associated with the user.',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    example: 'ETH/USDT',
    description: 'The trading pair to monitor for arbitrage opportunities.',
  })
  @IsString()
  @IsNotEmpty()
  pair: string;

  @ApiProperty({
    example: 1.0,
    description: 'The amount of the asset to trade.',
  })
  @Type(() => Number)
  @IsNumber()
  amountToTrade: number;

  @ApiProperty({
    example: 0.01,
    description:
      'Minimum profitability threshold as a decimal (e.g., 0.01 for 1%).',
  })
  @Type(() => Number)
  @IsNumber()
  minProfitability: number;

  @ApiProperty({
    example: 'binance',
    description: 'Name of the first exchange.',
  })
  @IsString()
  @IsNotEmpty()
  exchangeAName: string;

  @ApiProperty({ example: 'mexc', description: 'Name of the second exchange.' })
  @IsString()
  @IsNotEmpty()
  exchangeBName: string;

  @ApiProperty({ example: 10, description: 'interval to run arbitrage scan' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  checkIntervalSeconds?: number;

  @ApiProperty({ example: 1, description: 'Max number of orders' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxOpenOrders?: number;
}

export class PureMarketMakingStrategyDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Client ID' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ description: 'Trading pair', example: 'BTC/USDT' })
  @IsString()
  @IsNotEmpty()
  pair: string;

  @ApiProperty({
    description: 'Exchange name used for execution',
    example: 'binance',
  })
  @IsString()
  @IsNotEmpty()
  exchangeName: string;

  @ApiPropertyOptional({
    description:
      'If provided, this exchange is used as an oracle for price data instead of exchangeName',
    example: 'mexc',
  })
  @IsOptional()
  @IsString()
  oracleExchangeName?: string;

  @ApiProperty({ description: 'Bid spread as a percentage', example: 0.1 })
  @Type(() => Number)
  @IsNumber()
  bidSpread: number;

  @ApiProperty({ description: 'Ask spread as a percentage', example: 0.1 })
  @Type(() => Number)
  @IsNumber()
  askSpread: number;

  @ApiProperty({ description: 'Order amount', example: 0.1 })
  @Type(() => Number)
  @IsNumber()
  orderAmount: number;

  @ApiProperty({
    description: 'Order refresh time in milliseconds',
    example: 15000,
  })
  @Type(() => Number)
  @IsNumber()
  orderRefreshTime: number;

  @ApiProperty({
    description: 'Number of orders you want to place on both sides',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  numberOfLayers: number;

  @ApiProperty({
    description:
      'Price source type (MID_PRICE, BEST_BID, BEST_ASK, LAST_PRICE)',
    example: 'MID_PRICE',
    enum: PriceSourceType,
  })
  @IsEnum(PriceSourceType)
  priceSourceType: PriceSourceType;

  @ApiProperty({
    description:
      'Amount that increases on each layer, set to 0 for same amount',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  amountChangePerLayer: number; // This can be a fixed amount or a percentage

  @ApiProperty({
    description:
      'How the amountChangePerLayer should be interpreted (fixed, percentage)',
    example: 'percentage',
  })
  @IsIn(['fixed', 'percentage'])
  amountChangeType: 'fixed' | 'percentage';

  @ApiProperty({
    description: 'Ceiling Price, no buy orders above this price',
    example: '0',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ceilingPrice?: number;

  @ApiProperty({
    description: 'Floor price, no sell orders below this price.',
    example: '0',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  floorPrice?: number;

  @ApiPropertyOptional({
    description: 'Enable hanging orders behavior',
    example: true,
  })
  @IsOptional()
  hangingOrdersEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable maker-heavy quote widening mode',
    example: true,
  })
  @IsOptional()
  makerHeavyMode?: boolean;

  @ApiPropertyOptional({
    description: 'Maker-heavy widening bias in basis points',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  makerHeavyBiasBps?: number;

  @ApiPropertyOptional({
    description: 'Target base inventory ratio (0-1)',
    example: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  inventoryTargetBaseRatio?: number;

  @ApiPropertyOptional({
    description: 'Inventory skew factor for spread adjustment',
    example: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  inventorySkewFactor?: number;

  @ApiPropertyOptional({
    description: 'Current base inventory ratio estimate (0-1)',
    example: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentBaseRatio?: number;
}

export class ExecuteVolumeStrategyDto {
  @ApiProperty({ description: 'Name of the exchange' })
  @IsString()
  @IsNotEmpty()
  exchangeName: string;

  @ApiProperty({ description: 'Symbol to trade' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description:
      'Percentage increment for offsetting from midPrice (initial offset)',
  })
  @Type(() => Number)
  @IsNumber()
  incrementPercentage: number;

  @ApiProperty({
    description: 'Time interval (in seconds) between each trade execution',
  })
  @Type(() => Number)
  @IsNumber()
  intervalTime: number;

  @ApiProperty({ description: 'Base amount to trade per order' })
  @Type(() => Number)
  @IsNumber()
  tradeAmount: number;

  @ApiProperty({ description: 'Number of total trades to execute' })
  @Type(() => Number)
  @IsNumber()
  numTrades: number;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Client ID' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description:
      'Rate at which to push the price upward after each successful trade, in percent',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  pricePushRate: number;
}

export class StopVolumeStrategyDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Client ID' })
  @IsString()
  @IsNotEmpty()
  clientId: string;
}
