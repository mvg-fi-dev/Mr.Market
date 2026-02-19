import { Module } from '@nestjs/common';

import { TickModule } from 'src/modules/market-making/tick/tick.module';

import { MixinModule } from '../../mixin/mixin.module';
import { ExchangeInitModule } from '../exchange-init/exchange-init.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // NOTE: SnapshotsModule (via MixinModule) registers & exports Bull queues.
  imports: [MixinModule, ExchangeInitModule, TickModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
