import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceReadModel } from 'src/common/entities/ledger/balance-read-model.entity';
import { LedgerEntry } from 'src/common/entities/ledger/ledger-entry.entity';
import { BalanceLedgerService } from './balance-ledger.service';
import { DurabilityModule } from '../durability/durability.module';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry, BalanceReadModel]), DurabilityModule],
  providers: [BalanceLedgerService],
  exports: [BalanceLedgerService],
})
export class LedgerModule {}
