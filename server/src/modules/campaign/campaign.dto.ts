import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// NOTE: This DTO is returned by an external HuFi API in CampaignService.
// We still add validation decorators so that if this class is ever used
// as an inbound body DTO, ValidationPipe(whitelist + forbidNonWhitelisted)
// will correctly reject unexpected fields.

export class CampaignDataDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  chainId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  requesterAddress: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  exchangeName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  duration: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fundAmount: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  startBlock: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  endBlock: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  amountPaid: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  balance: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  count: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  factoryAddress: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  finalResultsUrl?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  intermediateResultsUrl?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  launcher: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  manifestHash?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  manifestUrl?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  recordingOracle?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  recordingOracleFee?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  reputationOracle?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  reputationOracleFee?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  exchangeOracle?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  exchangeOracleFee?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  totalFundedAmount: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  createdAt: string;
}
