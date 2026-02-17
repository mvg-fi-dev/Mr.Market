import { IsOptional, IsString } from 'class-validator';

export class CreateMarketMakingIntentDto {
  @IsString()
  marketMakingPairId: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
