import * as dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';

import { AppController } from './app.controller';
import { TradeModule } from './modules/market-making/trade/trade.module';
import { StrategyModule } from './modules/market-making/strategy/strategy.module';
import { MarketdataModule } from './modules/data/market-data/market-data.module';
import { PerformanceModule } from './modules/market-making/performance/performance.module';
import { UserOrdersModule } from './modules/market-making/user-orders/user-orders.module';

import configuration from './config/configuration';
import { HealthModule } from './modules/infrastructure/health/health.module';
import { CoingeckoModule } from './modules/data/coingecko/coingecko.module';
import { LoggerModule } from './modules/infrastructure/logger/logger.module';
import { CustomLogger } from './modules/infrastructure/logger/logger.service';
import { MixinModule } from './modules/mixin/mixin.module';
import { EventListenersModule } from './modules/mixin/listeners/events.module';

import { Trade } from './common/entities/orders/trade.entity';
import { Performance } from './common/entities/market-making/performance.entity';

import { SpotOrder } from './common/entities/orders/spot-order.entity';
import { APIKeysConfig } from './common/entities/admin/api-keys.entity';
import { CustomConfigEntity } from './common/entities/admin/custom-config.entity';
import {
  MixinReleaseToken,
  MixinReleaseHistory,
} from './common/entities/mixin/mixin-release.entity';
import { MixinMessage } from 'src/common/entities/mixin/mixin-message.entity';
import { MixinUser } from 'src/common/entities/mixin/mixin-user.entity';
import {
  MarketMakingOrder,
  SimplyGrowOrder,
} from './common/entities/orders/user-orders.entity';
import {
  MarketMakingPaymentState,
  PaymentState,
} from './common/entities/orders/payment-state.entity';
import { AuthModule } from './modules/auth/auth.module';
import { ExchangeInitModule } from './modules/infrastructure/exchange-init/exchange-init.module';
import { AdminModule } from './modules/admin/admin.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { Web3Module } from './modules/web3/web3.module';
import { StrategyInstance } from './common/entities/market-making/strategy-instances.entity';
import { ArbitrageHistory } from './common/entities/market-making/arbitrage-order.entity';
import { MarketMakingHistory } from './common/entities/market-making/market-making-order.entity';
import { Contribution } from './common/entities/campaign/contribution.entity';
import { GrowdataModule } from './modules/data/grow-data/grow-data.module';
import { MarketMakingOrderIntent } from './common/entities/market-making/market-making-order-intent.entity';
import {
  GrowdataArbitragePair,
  GrowdataExchange,
  GrowdataMarketMakingPair,
  GrowdataSimplyGrowToken,
} from './common/entities/data/grow-data.entity';
import { AdminController } from './modules/admin/admin.controller';
import { SpotdataTradingPair } from './common/entities/data/spot-data.entity';
import { SpotdataModule } from './modules/data/spot-data/spot-data.module';
import { MetricsModule } from './modules/market-making/metrics/metrics.module';
import { Withdrawal } from './common/entities/mixin/withdrawal.entity';
import { Campaign } from './common/entities/campaign/campaign.entity';
import { CampaignParticipation } from './common/entities/campaign/campaign-participation.entity';
import { LocalCampaignModule } from './modules/market-making/local-campaign/local-campaign.module';
import { TickModule } from './modules/market-making/tick/tick.module';
import { LedgerModule } from './modules/market-making/ledger/ledger.module';
import { LedgerEntry } from './common/entities/ledger/ledger-entry.entity';
import { BalanceReadModel } from './common/entities/ledger/balance-read-model.entity';
import { OutboxEvent } from './common/entities/system/outbox-event.entity';
import { ConsumerReceipt } from './common/entities/system/consumer-receipt.entity';
import { DurabilityModule } from './modules/market-making/durability/durability.module';
import { TrackersModule } from './modules/market-making/trackers/trackers.module';
import { ReconciliationModule } from './modules/market-making/reconciliation/reconciliation.module';
import { RewardsModule } from './modules/market-making/rewards/rewards.module';
import { RewardLedger } from './common/entities/ledger/reward-ledger.entity';
import { RewardAllocation } from './common/entities/ledger/reward-allocation.entity';
import { OrchestrationModule } from './modules/market-making/orchestration/orchestration.module';
import { ShareLedgerEntry } from './common/entities/ledger/share-ledger-entry.entity';
import { HufiScoreSnapshot } from './common/entities/campaign/hufi-score-snapshot.entity';
import { StrategyOrderIntentEntity } from './common/entities/market-making/strategy-order-intent.entity';

dotenv.config();

@Module({
  imports: [
    LoggerModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'data/mr_market.db',
      entities: [
        Trade,
        ArbitrageHistory,
        MarketMakingHistory,
        StrategyInstance,
        Performance,
        SpotOrder,
        APIKeysConfig,
        CustomConfigEntity,
        Contribution,
        MixinReleaseToken,
        MixinReleaseHistory,
        MixinMessage,
        MixinUser,
        MarketMakingOrder,
        PaymentState,
        MarketMakingPaymentState,
        SimplyGrowOrder,
        SpotdataTradingPair,
        GrowdataExchange,
        GrowdataSimplyGrowToken,
        GrowdataArbitragePair,
        GrowdataMarketMakingPair,
        Withdrawal,
        Campaign,
        CampaignParticipation,
        MarketMakingOrderIntent,
        LedgerEntry,
        BalanceReadModel,
        OutboxEvent,
        ConsumerReceipt,
        RewardLedger,
        RewardAllocation,
        ShareLedgerEntry,
        HufiScoreSnapshot,
        StrategyOrderIntentEntity,
      ],
      synchronize: false,
      migrationsRun: true,
      extra: {
        flags: ['-WAL'],
      },
    }),
    ScheduleModule.forRoot(),
    TradeModule,
    StrategyModule,
    PerformanceModule,
    MarketdataModule,
    SpotdataModule,
    GrowdataModule,
    ExchangeInitModule,
    CoingeckoModule,
    HealthModule,
    MixinModule,
    EventListenersModule,
    AuthModule,
    AdminModule,
    CampaignModule,
    Web3Module,
    MetricsModule,
    UserOrdersModule,
    LocalCampaignModule,
    TickModule,
    LedgerModule,
    DurabilityModule,
    TrackersModule,
    ReconciliationModule,
    RewardsModule,
    OrchestrationModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController, AdminController],
  providers: [CustomLogger],
})
export class AppModule {}
