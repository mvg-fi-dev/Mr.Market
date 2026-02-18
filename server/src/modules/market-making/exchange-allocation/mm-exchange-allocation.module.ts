import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MMExchangeAllocation } from 'src/common/entities/market-making/mm-exchange-allocation.entity';

import { MMExchangeAllocationService } from './mm-exchange-allocation.service';

@Module({
  imports: [TypeOrmModule.forFeature([MMExchangeAllocation])],
  providers: [MMExchangeAllocationService],
  exports: [MMExchangeAllocationService],
})
export class MMExchangeAllocationModule {}
