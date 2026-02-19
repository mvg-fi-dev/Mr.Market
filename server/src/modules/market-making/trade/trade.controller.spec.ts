import { Test, TestingModule } from '@nestjs/testing';

import { TradeController } from './trade.controller';
import { CancelTradeDto, LimitTradeDto, MarketTradeDto } from './trade.dto';
import { TradeService } from './trade.service';

describe('TradeController', () => {
  let controller: TradeController;
  let mockTradeService: Partial<TradeService>;

  beforeEach(async () => {
    mockTradeService = {
      executeMarketTrade: jest.fn(),
      executeLimitTrade: jest.fn(),
      cancelOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradeController],
      providers: [{ provide: TradeService, useValue: mockTradeService }],
    }).compile();

    controller = module.get<TradeController>(TradeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should execute a market trade', async () => {
    const dto: MarketTradeDto = {
      userId: '123',
      clientId: 'client1',
      traceId: 't1',
      exchange: 'binance',
      symbol: 'BTC/USD',
      side: 'buy',
      amount: 1,
    };

    await controller.executeMarketTrade(dto);
    expect(mockTradeService.executeMarketTrade).toHaveBeenCalledWith(dto);
  });

  it('should execute a limit trade', async () => {
    const dto: LimitTradeDto = {
      userId: '123',
      clientId: 'client1',
      traceId: 't2',
      exchange: 'binance',
      symbol: 'BTC/USD',
      side: 'sell',
      amount: 1,
      price: 50000,
    };

    await controller.executeLimitTrade(dto);
    expect(mockTradeService.executeLimitTrade).toHaveBeenCalledWith(dto);
  });

  it('should cancel an order', async () => {
    const dto: CancelTradeDto = {
      exchange: 'binance',
      orderId: 'order1',
      symbol: 'BTC/USDT',
      traceId: 't-cancel-1',
    };

    await controller.cancelOrder(dto);
    expect(mockTradeService.cancelOrder).toHaveBeenCalledWith(dto);
  });
});
