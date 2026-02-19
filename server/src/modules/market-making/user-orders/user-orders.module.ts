import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArbitrageHistory } from 'src/common/entities/market-making/arbitrage-order.entity';
import { MarketMakingHistory } from 'src/common/entities/market-making/market-making-order.entity';
import { MarketMakingOrderIntent } from 'src/common/entities/market-making/market-making-order-intent.entity';
import { MarketMakingPaymentState } from 'src/common/entities/orders/payment-state.entity';
import {
  MarketMakingOrder,
  SimplyGrowOrder,
} from 'src/common/entities/orders/user-orders.entity';
import { CampaignModule } from 'src/modules/campaign/campaign.module';
import { GrowdataModule } from 'src/modules/data/grow-data/grow-data.module';
import { MixinClientModule } from 'src/modules/mixin/client/mixin-client.module';
import { ExchangeModule } from 'src/modules/mixin/exchange/exchange.module';
import { SnapshotsModule } from 'src/modules/mixin/snapshots/snapshots.module';
import { TransactionModule } from 'src/modules/mixin/transaction/transaction.module';
import { WalletModule } from 'src/modules/mixin/wallet/wallet.module';
import { WithdrawalModule } from 'src/modules/mixin/withdrawal/withdrawal.module';

import { AdminOutboxModule } from 'src/modules/admin/outbox/admin-outbox.module';

import { DurabilityModule } from '../durability/durability.module';
import { MMExchangeAllocationModule } from '../exchange-allocation/mm-exchange-allocation.module';
import { FeeModule } from '../fee/fee.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LocalCampaignModule } from '../local-campaign/local-campaign.module';
import { NetworkMappingModule } from '../network-mapping/network-mapping.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { StrategyModule } from '../strategy/strategy.module';
import { MarketMakingOrderProcessor } from './market-making.processor';
import { UserOrdersController } from './user-orders.controller';
import { UserOrdersService } from './user-orders.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      MarketMakingOrder,
      MarketMakingPaymentState,
      MarketMakingOrderIntent,
      SimplyGrowOrder,
      MarketMakingHistory,
      ArbitrageHistory,
    ]),
    BullModule.registerQueue({
      name: 'market-making',
    }),
    StrategyModule,
    FeeModule,
    GrowdataModule,
    SnapshotsModule,
    TransactionModule,
    WithdrawalModule,
    WalletModule,
    LocalCampaignModule,
    ExchangeModule,
    NetworkMappingModule,
    MMExchangeAllocationModule,
    OrchestrationModule,
    CampaignModule,
    MixinClientModule,
    LedgerModule,
    DurabilityModule,
    AdminOutboxModule,
  ],
  controllers: [UserOrdersController],
  providers: [UserOrdersService, MarketMakingOrderProcessor],
  exports: [UserOrdersService],
})
export class UserOrdersModule {}
