import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceReadModel } from 'src/common/entities/ledger/balance-read-model.entity';
import { RewardAllocation } from 'src/common/entities/ledger/reward-allocation.entity';
import { RewardLedger } from 'src/common/entities/ledger/reward-ledger.entity';
import { MMExchangeAllocation } from 'src/common/entities/market-making/mm-exchange-allocation.entity';
import { StrategyOrderIntentEntity } from 'src/common/entities/market-making/strategy-order-intent.entity';
import { MarketMakingOrder } from 'src/common/entities/orders/user-orders.entity';
import { GrowdataModule } from 'src/modules/data/grow-data/grow-data.module';

import { DurabilityModule } from '../durability/durability.module';
import { TrackersModule } from '../trackers/trackers.module';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceReadModel,
      RewardLedger,
      RewardAllocation,
      StrategyOrderIntentEntity,
      MarketMakingOrder,
      MMExchangeAllocation,
    ]),
    BullModule.registerQueue({
      name: 'market-making',
    }),
    GrowdataModule,
    TrackersModule,
    DurabilityModule,
  ],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
