import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from 'src/common/entities/system/outbox-event.entity';

import { AdminOutboxController } from './admin-outbox.controller';
import { AdminOutboxService } from './admin-outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  controllers: [AdminOutboxController],
  providers: [AdminOutboxService],
  exports: [AdminOutboxService],
})
export class AdminOutboxModule {}
