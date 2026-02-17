import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// DTO for SpotdataTradingPair
export class SpotdataTradingPairDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  ccxt_id: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  exchange_id: string;

  @IsString()
  @IsNotEmpty()
  amount_significant_figures: string;

  @IsString()
  @IsNotEmpty()
  price_significant_figures: string;

  @IsString()
  @IsNotEmpty()
  buy_decimal_digits: string;

  @IsString()
  @IsNotEmpty()
  sell_decimal_digits: string;

  @IsString()
  @IsNotEmpty()
  max_buy_amount: string;

  @IsString()
  @IsNotEmpty()
  max_sell_amount: string;

  @IsString()
  @IsNotEmpty()
  base_asset_id: string;

  @IsString()
  @IsNotEmpty()
  quote_asset_id: string;

  @IsString()
  @IsOptional()
  custom_fee_rate: string;

  @IsBoolean()
  enable: boolean;
}

// Swagger + validation friendly DTO for partial updates.
// Partial<SpotdataTradingPairDto> in controller signatures does NOT
// carry runtime metadata, so Nest ValidationPipe cannot forbid extra fields.
export class SpotdataTradingPairUpdateDto extends PartialType(
  SpotdataTradingPairDto,
) {}
