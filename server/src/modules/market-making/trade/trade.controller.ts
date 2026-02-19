import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CustomLogger } from '../../infrastructure/logger/logger.service';
import { TradeHistoryResponseDto } from './trade-history.dto';
import { CancelTradeDto, LimitTradeDto, MarketTradeDto } from './trade.dto';
import { TradeService } from './trade.service';

@ApiTags('Trading Engine')
@Controller('trade')
export class TradeController {
  private readonly logger = new CustomLogger(TradeController.name);

  constructor(private readonly tradeService: TradeService) {}

  @Post('/market')
  @ApiOperation({ summary: 'Execute a market trade' })
  @ApiResponse({ status: 200, description: 'Trade executed successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid market trade parameters.' })
  async executeMarketTrade(@Body() marketTradeDto: MarketTradeDto) {
    if (
      !marketTradeDto.symbol ||
      !marketTradeDto.side ||
      !marketTradeDto.amount
    ) {
      throw new BadRequestException('Invalid market trade parameters.');
    }

    try {
      const order = await this.tradeService.executeMarketTrade(marketTradeDto);

      this.logger.log(
        `Market trade executed for symbol ${marketTradeDto.symbol}`,
      );

      return order;
    } catch (error) {
      this.logger.error(`Error executing market trade: ${error.message}`);
      throw error; // Re-throw the error for global error handling
    }
  }

  @Post('/limit')
  @ApiOperation({ summary: 'Execute a limit trade' })
  @ApiResponse({ status: 200, description: 'Trade executed successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid limit trade parameters.' })
  async executeLimitTrade(@Body() limitTradeDto: LimitTradeDto) {
    if (
      !limitTradeDto.symbol ||
      !limitTradeDto.side ||
      !limitTradeDto.amount ||
      !limitTradeDto.price
    ) {
      throw new BadRequestException('Invalid limit trade parameters.');
    }

    try {
      const order = await this.tradeService.executeLimitTrade(limitTradeDto);

      this.logger.log(
        `Limit trade executed for symbol ${limitTradeDto.symbol}`,
      );

      return order;
    } catch (error) {
      this.logger.error(`Error executing limit trade: ${error.message}`);
      throw error; // Re-throw the error for global error handling
    }
  }

  @Post('/cancel')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid cancel parameters.' })
  async cancelOrder(@Body() dto: CancelTradeDto) {
    if (!dto.exchange || !dto.orderId || !dto.symbol) {
      throw new BadRequestException('Invalid cancel parameters.');
    }

    return this.tradeService.cancelOrder(dto);
  }

  @Get('/history/:clientId')
  @ApiOperation({
    summary:
      'List trade records by clientId (market-making orderId) for lifecycle/audit',
  })
  @ApiParam({ name: 'clientId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'Trade history by clientId',
    type: TradeHistoryResponseDto,
  })
  async getTradeHistoryByClientId(
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string,
  ): Promise<TradeHistoryResponseDto> {
    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    const n = Number(limit);
    const effectiveLimit = Number.isFinite(n) ? Math.trunc(n) : 200;

    return await this.tradeService.getTradeHistoryByClientId(
      clientId,
      effectiveLimit,
    );
  }
}

