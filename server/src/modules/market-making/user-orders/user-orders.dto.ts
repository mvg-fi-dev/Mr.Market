import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StopMarketMakingDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreateMarketMakingIntentDto {
  @IsString()
  @IsNotEmpty()
  marketMakingPairId: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
