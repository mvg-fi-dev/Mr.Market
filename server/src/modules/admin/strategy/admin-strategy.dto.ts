import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import {
  ArbitrageStrategyDto,
  ExecuteVolumeStrategyDto,
  PureMarketMakingStrategyDto,
} from '../../market-making/strategy/strategy.dto';

// Unified DTO for starting strategies that handles all types
export class StartStrategyDto {
  @ApiProperty({
    description: 'Type of strategy to start',
    example: 'arbitrage',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['arbitrage', 'marketMaking', 'volume'])
  strategyType: 'arbitrage' | 'marketMaking' | 'volume';

  @ApiPropertyOptional({
    description: 'Parameters for arbitrage strategy (required for arbitrage)',
    type: ArbitrageStrategyDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArbitrageStrategyDto)
  arbitrageParams?: ArbitrageStrategyDto;

  @ApiPropertyOptional({
    description:
      'Parameters for market making strategy (required for market making)',
    type: PureMarketMakingStrategyDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PureMarketMakingStrategyDto)
  marketMakingParams?: PureMarketMakingStrategyDto;

  @ApiPropertyOptional({
    description: 'Parameters for volume strategy (required for volume)',
    type: ExecuteVolumeStrategyDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteVolumeStrategyDto)
  volumeParams?: ExecuteVolumeStrategyDto;

  @ApiPropertyOptional({
    description: 'Check interval in seconds (arbitrage-specific)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  checkIntervalSeconds?: number;

  @ApiPropertyOptional({
    description: 'Max open orders (arbitrage-specific)',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxOpenOrders?: number;
}

// Stop Strategy DTO for stopping a strategy
export class StopStrategyDto {
  @ApiProperty({
    description: 'User ID associated with the strategy',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Client ID associated with the strategy',
    example: '456',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Type of strategy to stop',
    example: 'arbitrage',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['arbitrage', 'marketMaking', 'volume'])
  strategyType: 'arbitrage' | 'marketMaking' | 'volume';
}

export class GetDepositAddressDto {
  @ApiProperty({
    description: 'exchangeName',
    example: 'binance',
  })
  @IsString()
  @IsNotEmpty()
  exchangeName: string;

  @ApiProperty({
    description: 'The token to be deposited',
    example: 'USDT',
  })
  @IsString()
  @IsNotEmpty()
  tokenSymbol: string;

  @ApiProperty({
    description: 'The network to deposit on',
    example: 'ERC20',
  })
  @IsString()
  @IsNotEmpty()
  network: string;

  @ApiPropertyOptional({
    description: 'default or account2',
    example: 'default',
  })
  @IsOptional()
  @IsString()
  accountLabel?: string; // Optional label for the account
}

// DTO to define the expected body structure
export class GetTokenSymbolDto {
  @ApiProperty({
    description: 'The contract address of the token (ERC-20)',
    example: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  })
  @IsString()
  @IsNotEmpty()
  contractAddress: string;

  @ApiProperty({
    description:
      'The chain ID of the blockchain (e.g., 1 for Ethereum Mainnet, 56 for Binance Smart Chain)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  chainId: number;
}

export class GetSupportedNetworksDto {
  @ApiProperty({
    description: 'The name of the exchange (e.g., binance, kraken, etc.)',
    example: 'binance',
  })
  @IsString()
  @IsNotEmpty()
  exchangeName: string;

  @ApiProperty({
    description: 'The symbol of the token (e.g., BTC, ETH, USDT, etc.)',
    example: 'USDT',
  })
  @IsString()
  @IsNotEmpty()
  tokenSymbol: string;

  @ApiPropertyOptional({
    description:
      'Optional account label, if there are multiple accounts on the exchange',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountLabel?: string;
}

export class JoinStrategyDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  strategyId: string;

  @Type(() => Number)
  @IsNumber()
  amount: number;
}
