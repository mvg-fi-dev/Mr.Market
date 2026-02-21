// In trade.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Trade } from 'src/common/entities/orders/trade.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TradeRepository {
  constructor(
    @InjectRepository(Trade)
    private readonly repository: Repository<Trade>,
  ) {}

  async findTradesByUser(userId: string, limit = 200): Promise<Trade[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  async findTradesByClient(clientId: string, limit = 200): Promise<Trade[]> {
    return this.repository.find({
      where: { clientId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  async findLatestTradeByExchangeOrderId(
    exchangeOrderId: string,
  ): Promise<Trade | null> {
    const found = await this.repository.find({
      where: { orderId: exchangeOrderId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 1,
    });

    return found?.[0] ?? null;
  }

  async createTrade(transactionData: Partial<Trade>): Promise<Trade> {
    // Convert numeric amount and price to strings for SQLite storage
    const dataToSave = {
      ...transactionData,
      amount: transactionData.amount?.toString() ?? '0',
      price: transactionData.price?.toString() ?? '0',
    };
    const transaction = this.repository.create(dataToSave);

    return this.repository.save(transaction);
  }

  async updateTradeStatus(orderId: string, status: string): Promise<void> {
    await this.repository.update({ orderId }, { status });
  }
}
