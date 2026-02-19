import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trade } from 'src/common/entities/orders/trade.entity';

import { DurabilityModule } from '../durability/durability.module';
import { TradeController } from './trade.controller';
import { TradeRepository } from './trade.repository';
import { TradeService } from './trade.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trade]), DurabilityModule],
  controllers: [TradeController],
  providers: [TradeService, TradeRepository],
  exports: [TradeService, TradeRepository],
})
export class TradeModule {}
