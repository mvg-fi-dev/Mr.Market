import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// ----------
// External (HTTP) request DTOs
// These are intentionally db-only for API key selection (no apiKeyId allowed).
// ----------

export class ExchangeWithdrawalRequestDto {
  @ApiProperty({ description: 'The name of exchange' })
  @IsString()
  @IsNotEmpty()
  exchange: string;

  @ApiProperty({ description: 'The asset symbol (like BTC)' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ description: 'The chain of asset' })
  @IsString()
  @IsNotEmpty()
  network: string;

  @ApiProperty({ description: 'Recipient address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Memo', required: false })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiProperty({ description: 'Withdrawal amount' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class ExchangeDepositRequestDto {
  @ApiProperty({ description: 'The name of exchange' })
  @IsString()
  @IsNotEmpty()
  exchange: string;

  @ApiProperty({ description: 'The asset symbol (like BTC)' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ description: 'The chain of asset' })
  @IsString()
  @IsNotEmpty()
  network: string;
}

export class ExchangeDepositsRequestDto {
  @ApiProperty({ description: 'The name of exchange' })
  @IsString()
  @IsNotEmpty()
  exchange: string;

  @ApiProperty({ description: 'The asset symbol (like BTC)', required: false })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiProperty({ description: 'The chain of asset', required: false })
  @IsString()
  @IsOptional()
  network?: string;

  @ApiProperty({
    description: 'Fetch deposits since (ms epoch)',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  since?: number;

  @ApiProperty({ description: 'Max deposits to return', required: false })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  limit?: number;
}

// ----------
// Internal DTOs
// These are used by internal jobs/processors that already know the apiKeyId.
// ----------

export class ExchangeWithdrawalDto extends ExchangeWithdrawalRequestDto {
  @ApiProperty({ description: 'The id of api key' })
  @IsString()
  @IsNotEmpty()
  apiKeyId: string;
}

export class ExchangeDepositDto extends ExchangeDepositRequestDto {
  @ApiProperty({ description: 'The id of api key' })
  @IsString()
  @IsNotEmpty()
  apiKeyId: string;
}

export class ExchangeDepositsDto extends ExchangeDepositsRequestDto {
  @ApiProperty({ description: 'The id of api key' })
  @IsString()
  @IsNotEmpty()
  apiKeyId: string;
}
