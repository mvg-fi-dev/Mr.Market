import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import { randomUUID } from 'crypto';
import { MMExchangeAllocation } from 'src/common/entities/market-making/mm-exchange-allocation.entity';
import { getRFC3339Timestamp } from 'src/common/helpers/utils';
import { Repository } from 'typeorm';

@Injectable()
export class MMExchangeAllocationService {
  constructor(
    @InjectRepository(MMExchangeAllocation)
    private readonly repository: Repository<MMExchangeAllocation>,
  ) {}

  async getByOrderId(orderId: string): Promise<MMExchangeAllocation | null> {
    return await this.repository.findOne({ where: { orderId } });
  }

  async getOrCreate(params: {
    orderId: string;
    userId: string;
    exchange: string;
    baseAssetId: string;
    baseSymbol: string;
    baseAllocatedAmount: string;
    quoteAssetId: string;
    quoteSymbol: string;
    quoteAllocatedAmount: string;
  }): Promise<MMExchangeAllocation> {
    const existing = await this.getByOrderId(params.orderId);

    if (existing) {
      return existing;
    }

    const now = getRFC3339Timestamp();

    const entity = this.repository.create({
      id: randomUUID(),
      orderId: params.orderId,
      userId: params.userId,
      exchange: params.exchange,
      baseAssetId: params.baseAssetId,
      baseSymbol: params.baseSymbol,
      baseAllocatedAmount: new BigNumber(
        params.baseAllocatedAmount || 0,
      ).toFixed(),
      quoteAssetId: params.quoteAssetId,
      quoteSymbol: params.quoteSymbol,
      quoteAllocatedAmount: new BigNumber(
        params.quoteAllocatedAmount || 0,
      ).toFixed(),
      state: 'created',
      createdAt: now,
      updatedAt: now,
    });

    return await this.repository.save(entity);
  }

  async markExchangeDepositConfirmed(orderId: string): Promise<void> {
    const now = getRFC3339Timestamp();

    await this.repository.update(
      { orderId },
      { state: 'exchange_deposit_confirmed', updatedAt: now },
    );
  }

  async markExitWithdrawing(orderId: string): Promise<void> {
    const now = getRFC3339Timestamp();

    await this.repository.update(
      { orderId },
      { state: 'exit_withdrawing', updatedAt: now },
    );
  }

  async markExitComplete(orderId: string): Promise<void> {
    const now = getRFC3339Timestamp();

    await this.repository.update(
      { orderId },
      {
        state: 'exit_complete',
        baseAllocatedAmount: '0',
        quoteAllocatedAmount: '0',
        updatedAt: now,
      },
    );
  }
}
