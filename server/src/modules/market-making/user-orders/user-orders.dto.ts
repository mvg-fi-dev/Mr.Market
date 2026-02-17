import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMarketMakingIntentDto {
  @IsString()
  @IsNotEmpty()
  marketMakingPairId: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
