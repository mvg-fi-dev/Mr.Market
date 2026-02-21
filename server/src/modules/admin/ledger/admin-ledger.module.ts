import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from 'src/common/entities/ledger/ledger-entry.entity';

import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry])],
  controllers: [AdminLedgerController],
  providers: [AdminLedgerService],
  exports: [AdminLedgerService],
})
export class AdminLedgerModule {}
