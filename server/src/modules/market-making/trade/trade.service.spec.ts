import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as ccxt from 'ccxt';
import { ExchangeInitService } from 'src/modules/infrastructure/exchange-init/exchange-init.service';

import { CustomLogger } from '../../infrastructure/logger/logger.service';
import { DurabilityService } from '../durability/durability.service';
import { CancelTradeDto, LimitTradeDto, MarketTradeDto } from './trade.dto';
import { TradeRepository } from './trade.repository';
import { TradeService } from './trade.service';

jest.mock('ccxt');

describe('TradeService', () => {
  let service: TradeService;
  let tradeRepository: TradeRepository;
  let exchangeInitService: ExchangeInitService;
  let exchangeMock;
  let durabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        {
          provide: TradeRepository,
          useValue: {
            createTrade: jest.fn(),
            updateTradeStatus: jest.fn(),
          },
        },
        {
          provide: ExchangeInitService,
          useValue: {
            getExchange: jest.fn(),
          },
        },
        {
          provide: DurabilityService,
          useValue: {
            appendOutboxEvent: jest.fn(),
          },
        },
        CustomLogger,
      ],
    }).compile();

    service = module.get<TradeService>(TradeService);
    tradeRepository = module.get<TradeRepository>(TradeRepository);
    exchangeInitService = module.get<ExchangeInitService>(ExchangeInitService);
    durabilityService = module.get(DurabilityService);
    exchangeMock = new ccxt.binance();
  });

  describe('executeMarketTrade', () => {
    it('should execute a market trade successfully', async () => {
      const marketTradeDto: MarketTradeDto = {
        userId: 'user123',
        clientId: 'client123',
        traceId: 't1',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
      };

      const orderMock = {
        id: 'order123',
        status: 'closed',
        price: 30000,
      };

      exchangeInitService.getExchange = jest.fn().mockReturnValue(exchangeMock);
      exchangeMock.createOrder = jest.fn().mockResolvedValue(orderMock);

      const order = await service.executeMarketTrade(marketTradeDto);

      expect(order).toEqual(orderMock);

      expect(exchangeInitService.getExchange).toHaveBeenCalledWith('binance');
      expect(exchangeMock.createOrder).toHaveBeenCalledWith(
        'BTC/USDT',
        'market',
        'buy',
        1,
      );
      expect(tradeRepository.createTrade).toHaveBeenCalledWith({
        userId: 'user123',
        clientId: 'client123',
        exchange: 'binance',
        traceId: 't1',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: '1',
        status: 'closed',
        price: '30000',
        orderId: 'order123',
      });

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'market_making.trade.executed',
          aggregateType: 'trade',
          aggregateId: 'binance:order123',
        }),
      );
    });

    it('should throw BadRequestException if required parameters are missing', async () => {
      const marketTradeDto: MarketTradeDto = {
        userId: 'user123',
        clientId: 'client123',
        traceId: 't2',
        exchange: 'binance',
        symbol: '',
        side: 'buy',
        amount: 1,
      };

      await expect(service.executeMarketTrade(marketTradeDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException if trade execution fails', async () => {
      const marketTradeDto: MarketTradeDto = {
        userId: 'user123',
        clientId: 'client123',
        traceId: 't3',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
      };

      exchangeInitService.getExchange = jest.fn().mockReturnValue(exchangeMock);
      exchangeMock.createOrder = jest
        .fn()
        .mockRejectedValue(new Error('Trade failed'));

      await expect(service.executeMarketTrade(marketTradeDto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(tradeRepository.createTrade).not.toHaveBeenCalled();

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'market_making.trade.failed',
          payload: expect.objectContaining({
            errorCode: 'UNKNOWN',
            retryable: false,
          }),
        }),
      );
    });
  });

  describe('executeLimitTrade', () => {
    it('should execute a limit trade successfully', async () => {
      const limitTradeDto: LimitTradeDto = {
        userId: 'user123',
        clientId: 'client123',
        traceId: 't4',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        price: 30000,
      };

      const orderMock = {
        id: 'order123',
        status: 'open',
        price: 30000,
      };

      exchangeInitService.getExchange = jest.fn().mockReturnValue(exchangeMock);
      exchangeMock.createOrder = jest.fn().mockResolvedValue(orderMock);

      const order = await service.executeLimitTrade(limitTradeDto);

      expect(order).toEqual(orderMock);

      expect(exchangeInitService.getExchange).toHaveBeenCalledWith('binance');
      expect(exchangeMock.createOrder).toHaveBeenCalledWith(
        'BTC/USDT',
        'limit',
        'buy',
        1,
        30000,
      );
      expect(tradeRepository.createTrade).toHaveBeenCalledWith({
        userId: 'user123',
        clientId: 'client123',
        exchange: 'binance',
        traceId: 't4',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        amount: '1',
        price: '30000',
        status: 'open',
        orderId: 'order123',
      });

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'market_making.trade.executed',
          aggregateType: 'trade',
          aggregateId: 'binance:order123',
        }),
      );
    });

    it('should throw BadRequestException if required parameters are missing', async () => {
      const limitTradeDto: LimitTradeDto = {
        userId: 'user123',
        clientId: 'client123',
        traceId: 't5',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        price: null,
      };

      await expect(service.executeLimitTrade(limitTradeDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException if trade execution fails', async () => {
      const limitTradeDto: LimitTradeDto = {
        userId: 'user123',
        clientId: 'client123',
        traceId: 't6',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        price: 30000,
      };

      exchangeInitService.getExchange = jest.fn().mockReturnValue(exchangeMock);
      exchangeMock.createOrder = jest
        .fn()
        .mockRejectedValue(new Error('Trade failed'));

      await expect(service.executeLimitTrade(limitTradeDto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(tradeRepository.createTrade).not.toHaveBeenCalled();

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'market_making.trade.failed',
          payload: expect.objectContaining({
            errorCode: 'UNKNOWN',
            retryable: false,
          }),
        }),
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order successfully', async () => {
      const request: CancelTradeDto = {
        exchange: 'binance',
        orderId: 'order123',
        symbol: 'BTC/USDT',
        traceId: 't-cancel-1',
        userId: 'user123',
        clientId: 'client123',
      };

      exchangeInitService.getExchange = jest.fn().mockReturnValue(exchangeMock);
      exchangeMock.cancelOrder = jest.fn().mockResolvedValue({});

      await service.cancelOrder(request);

      expect(exchangeInitService.getExchange).toHaveBeenCalledWith('binance');
      expect(exchangeMock.cancelOrder).toHaveBeenCalledWith(
        'order123',
        'BTC/USDT',
      );
      expect(tradeRepository.updateTradeStatus).toHaveBeenCalledWith(
        'order123',
        'cancelled',
      );

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'market_making.trade.cancelled',
          aggregateType: 'trade',
          aggregateId: 'binance:order123',
        }),
      );

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'client123',
          payload: expect.objectContaining({
            traceId: 't-cancel-1',
            exchange: 'binance',
            orderId: 'client123',
            exchangeOrderId: 'order123',
            symbol: 'BTC/USDT',
            userId: 'user123',
            clientId: 'client123',
          }),
        }),
      );
    });

    it('should throw InternalServerErrorException if order cancellation fails', async () => {
      const request: CancelTradeDto = {
        exchange: 'binance',
        orderId: 'order123',
        symbol: 'BTC/USDT',
        traceId: 't-cancel-2',
      };

      exchangeInitService.getExchange = jest.fn().mockReturnValue(exchangeMock);
      exchangeMock.cancelOrder = jest
        .fn()
        .mockRejectedValue(new Error('Cancellation failed'));

      await expect(service.cancelOrder(request)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'market_making.trade.cancel_failed',
          aggregateType: 'trade',
          aggregateId: 'binance:order123',
        }),
      );

      expect(durabilityService.appendOutboxEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            traceId: 't-cancel-2',
            exchange: 'binance',
            exchangeOrderId: 'order123',
            symbol: 'BTC/USDT',
            errorCode: 'UNKNOWN',
            retryable: false,
          }),
        }),
      );
    });
  });
});
