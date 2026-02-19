import { Test, TestingModule } from '@nestjs/testing';

import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

describe('TradeController (history)', () => {
  let controller: TradeController;

  const mockTradeService = {
    getTradeHistoryByClientId: jest.fn(),
    executeMarketTrade: jest.fn(),
    executeLimitTrade: jest.fn(),
    cancelOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradeController],
      providers: [{ provide: TradeService, useValue: mockTradeService }],
    }).compile();

    controller = module.get<TradeController>(TradeController);
    jest.clearAllMocks();
  });

  it('returns trade history via service and applies default limit', async () => {
    mockTradeService.getTradeHistoryByClientId.mockResolvedValueOnce({
      ok: true,
      clientId: 'order-1',
      trades: [],
    });

    const res = await (controller as any).getTradeHistoryByClientId('order-1');

    expect(mockTradeService.getTradeHistoryByClientId).toHaveBeenCalledWith(
      'order-1',
      200,
    );

    expect(res).toEqual({ ok: true, clientId: 'order-1', trades: [] });
  });

  it('parses limit query string', async () => {
    mockTradeService.getTradeHistoryByClientId.mockResolvedValueOnce({
      ok: true,
      clientId: 'order-1',
      trades: [],
    });

    await (controller as any).getTradeHistoryByClientId('order-1', '10');

    expect(mockTradeService.getTradeHistoryByClientId).toHaveBeenCalledWith(
      'order-1',
      10,
    );
  });
});
