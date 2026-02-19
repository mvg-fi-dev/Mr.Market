import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as ccxt from 'ccxt';
import { getRFC3339Timestamp } from 'src/common/helpers/utils';
import { ExchangeInitService } from 'src/modules/infrastructure/exchange-init/exchange-init.service';

import { CustomLogger } from '../../infrastructure/logger/logger.service';
import { DurabilityService } from '../durability/durability.service';
import { CancelTradeDto, LimitTradeDto, MarketTradeDto } from './trade.dto';
import { TradeRepository } from './trade.repository';
import { classifyCcxtError } from './trade-error-taxonomy';

@Injectable()
export class TradeService {
  private exchange: ccxt.Exchange;
  private readonly logger = new CustomLogger(TradeService.name);

  constructor(
    private tradeRepository: TradeRepository,
    private exchangeInitService: ExchangeInitService,
    private readonly durabilityService: DurabilityService,
  ) {}

  private getExchange(exchangeName: string): ccxt.Exchange {
    const exchange = this.exchangeInitService.getExchange(exchangeName);

    if (!exchange) {
      this.logger.error(`Exchange: ${exchangeName} is not configured.`);
      throw new InternalServerErrorException('Exchange configuration error.');
    }

    return exchange;
  }

  async executeMarketTrade(
    marketTradeDto: MarketTradeDto,
  ): Promise<ccxt.Order> {
    const { userId, clientId, traceId, exchange, symbol, side, amount } =
      marketTradeDto;

    const effectiveTraceId = traceId || `trade:${clientId}`;

    if (!symbol || !side || !amount) {
      throw new BadRequestException(
        'Missing required parameters for market trade.',
      );
    }

    this.exchange = this.getExchange(exchange);

    try {
      const order = await this.exchange.createOrder(
        symbol,
        'market',
        side,
        amount,
      );

      this.logger.log(`Market trade executed`, order.toString());
      await this.tradeRepository.createTrade({
        userId,
        clientId,
        exchange,
        traceId: effectiveTraceId,
        symbol,
        type: 'market',
        side: side,
        amount: amount.toString(),
        status: order.status,
        price: (order.price || 0).toString(), // Assuming the order object has a price field
        orderId: order.id, // Assuming the order object has an id field
      });

      await this.durabilityService.appendOutboxEvent({
        topic: 'market_making.trade.executed',
        aggregateType: 'trade',
        aggregateId: `${exchange}:${order.id}`,
        // For market-making, clientId === orderId.
        orderId: clientId,
        payload: {
          eventType: 'TRADE_EXECUTED',
          traceId: effectiveTraceId,
          orderId: clientId,
          exchangeOrderId: order.id,
          exchange,
          symbol,
          side,
          type: 'market',
          amount: amount.toString(),
          price: (order.price || 0).toString(),
          status: order.status,
          userId,
          clientId,
          createdAt: getRFC3339Timestamp(),
        },
      });

      return order;
    } catch (error) {
      const classification = classifyCcxtError(error);

      this.logger.error(
        `Failed to execute market trade: ${classification.errorCode} ${classification.errorName} ${classification.errorMessage}`,
      );

      await this.durabilityService.appendOutboxEvent({
        topic: 'market_making.trade.failed',
        aggregateType: 'trade',
        aggregateId: `${exchange}:market:${clientId}`,
        orderId: clientId,
        payload: {
          eventType: 'TRADE_FAILED',
          traceId: effectiveTraceId,
          orderId: clientId,
          exchange,
          symbol,
          side,
          type: 'market',
          amount: amount.toString(),
          userId,
          clientId,
          errorCode: classification.errorCode,
          retryable: classification.retryable,
          errorName: classification.errorName,
          errorMessage: classification.errorMessage,
          failedAt: getRFC3339Timestamp(),
        },
      });

      throw new InternalServerErrorException(
        `Trade execution failed: ${classification.errorMessage}`,
      );
    }
  }

  async executeLimitTrade(limitTradeDto: LimitTradeDto): Promise<ccxt.Order> {
    const { userId, clientId, traceId, exchange, symbol, side, amount, price } =
      limitTradeDto;

    const effectiveTraceId = traceId || `trade:${clientId}`;

    if (!symbol || !side || !amount || !price) {
      throw new BadRequestException(
        'Missing required parameters for limit trade.',
      );
    }

    this.exchange = this.getExchange(exchange);

    try {
      const order = await this.exchange.createOrder(
        symbol,
        'limit',
        side,
        amount,
        price,
      );

      this.logger.log(`Limit trade executed: ${JSON.stringify(order)}`);

      await this.tradeRepository.createTrade({
        userId,
        clientId,
        exchange,
        traceId: effectiveTraceId,
        symbol,
        side: side,
        type: 'limit',
        amount: amount.toString(),
        price: price.toString(),
        status: order.status,
        orderId: order.id, // Assuming the order object has an id field
      });

      await this.durabilityService.appendOutboxEvent({
        topic: 'market_making.trade.executed',
        aggregateType: 'trade',
        aggregateId: `${exchange}:${order.id}`,
        orderId: clientId,
        payload: {
          eventType: 'TRADE_EXECUTED',
          traceId: effectiveTraceId,
          orderId: clientId,
          exchangeOrderId: order.id,
          exchange,
          symbol,
          side,
          type: 'limit',
          amount: amount.toString(),
          price: price.toString(),
          status: order.status,
          userId,
          clientId,
          createdAt: getRFC3339Timestamp(),
        },
      });

      return order;
    } catch (error) {
      const classification = classifyCcxtError(error);

      this.logger.error(
        `Failed to execute limit trade: ${classification.errorCode} ${classification.errorName} ${classification.errorMessage}`,
      );

      await this.durabilityService.appendOutboxEvent({
        topic: 'market_making.trade.failed',
        aggregateType: 'trade',
        aggregateId: `${exchange}:limit:${clientId}`,
        orderId: clientId,
        payload: {
          eventType: 'TRADE_FAILED',
          traceId: effectiveTraceId,
          orderId: clientId,
          exchange,
          symbol,
          side,
          type: 'limit',
          amount: amount.toString(),
          price: price.toString(),
          userId,
          clientId,
          errorCode: classification.errorCode,
          retryable: classification.retryable,
          errorName: classification.errorName,
          errorMessage: classification.errorMessage,
          failedAt: getRFC3339Timestamp(),
        },
      });

      throw new InternalServerErrorException(
        `Trade execution failed: ${classification.errorMessage}`,
      );
    }
  }

  async cancelOrder(request: CancelTradeDto): Promise<void> {
    const { exchange, orderId, symbol, traceId, userId, clientId } = request;

    const effectiveTraceId = traceId || `trade:cancel:${clientId || orderId}`;

    const exchangeInstance = this.getExchange(exchange);

    try {
      await exchangeInstance.cancelOrder(orderId, symbol);

      // update the transaction status in database
      await this.tradeRepository.updateTradeStatus(orderId, 'cancelled');

      await this.durabilityService.appendOutboxEvent({
        topic: 'market_making.trade.cancelled',
        aggregateType: 'trade',
        aggregateId: `${exchange}:${orderId}`,
        // For market-making, clientId === orderId.
        orderId: clientId || '',
        payload: {
          eventType: 'TRADE_CANCELLED',
          traceId: effectiveTraceId,
          orderId: clientId || '',
          exchangeOrderId: orderId,
          exchange,
          symbol,
          userId,
          clientId,
          cancelledAt: getRFC3339Timestamp(),
        },
      });
    } catch (error) {
      const classification = classifyCcxtError(error);

      this.logger.error(
        `Failed to cancel order: ${classification.errorCode} ${classification.errorName} ${classification.errorMessage}`,
      );

      await this.durabilityService.appendOutboxEvent({
        topic: 'market_making.trade.cancel_failed',
        aggregateType: 'trade',
        aggregateId: `${exchange}:${orderId}`,
        orderId: clientId || '',
        payload: {
          eventType: 'TRADE_CANCEL_FAILED',
          traceId: effectiveTraceId,
          orderId: clientId || '',
          exchangeOrderId: orderId,
          exchange,
          symbol,
          userId,
          clientId,
          errorCode: classification.errorCode,
          retryable: classification.retryable,
          errorName: classification.errorName,
          errorMessage: classification.errorMessage,
          failedAt: getRFC3339Timestamp(),
        },
      });

      throw new InternalServerErrorException(
        `Order cancellation failed: ${classification.errorMessage}`,
      );
    }
  }
}
