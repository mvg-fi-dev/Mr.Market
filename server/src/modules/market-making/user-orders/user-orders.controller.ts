import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MarketMakingHistory } from 'src/common/entities/market-making/market-making-order.entity';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';

import { ExitMarketMakingDto, StopMarketMakingDto } from './user-orders.dto';
import { CreateMarketMakingIntentDto } from './user-orders.dto';
import { UserOrdersService } from './user-orders.service';

@ApiTags('Trading Engine')
@Controller('user-orders')
export class UserOrdersController {
  private readonly logger = new CustomLogger(UserOrdersController.name);

  constructor(private readonly userOrdersService: UserOrdersService) {}

  @Get('/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all strategy by user' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'All strategies of user.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getAllStrategy(@Query('userId') userId: string) {
    return await this.userOrdersService.findAllStrategyByUser(userId);
  }

  @Get('/payment-state/market-making/:order_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payment state by id' })
  @ApiResponse({
    status: 200,
    description: 'The payment state of order.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getMarketMakingPaymentState(@Param('order_id') orderId: string) {
    return await this.userOrdersService.findMarketMakingPaymentStateById(
      orderId,
    );
  }

  @Get('/simply-grow/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all simply grow orders by user' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'All simply grow orders of user.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getSimplyGrowByUserId(@Query('user_id') userId: string) {
    return await this.userOrdersService.findSimplyGrowByUserId(userId);
  }

  @Get('/simply-grow/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get simply grow order by id' })
  @ApiQuery({ name: 'id', type: String, description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'The details of the simply grow order.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getSimplyGrowByOrderId(@Param('id') id: string) {
    return await this.userOrdersService.findSimplyGrowByOrderId(id);
  }

  @Get('/market-making/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all market making by user' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'All market making order of user.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getAllMarketMakingByUser(@Query('userId') userId: string) {
    return await this.userOrdersService.findMarketMakingByUserId(userId);
  }

  @Get('/market-making/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all market making by user' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'The details of the market making.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getMarketMakingDetailsById(@Param('id') id: string) {
    return await this.userOrdersService.findMarketMakingByOrderId(id);
  }

  @Post('/market-making/intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create market making order intent' })
  @ApiResponse({
    status: 200,
    description: 'Market making order intent created.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async createMarketMakingIntent(@Body() body: CreateMarketMakingIntentDto) {
    return await this.userOrdersService.createMarketMakingOrderIntent(body);
  }

  @Post('/market-making/:orderId/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft stop market making (stop strategy, no exit)' })
  @ApiResponse({
    status: 200,
    description: 'Market making stop queued.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async stopMarketMaking(
    @Param('orderId') orderId: string,
    @Body() body: StopMarketMakingDto,
  ) {
    this.logger.log(`Soft stop market making requested: orderId=${orderId}`);

    await this.userOrdersService.stopMarketMaking(body.userId, orderId);

    return { ok: true };
  }

  @Post('/market-making/:orderId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause market making (stop strategy and mark paused)',
  })
  @ApiResponse({
    status: 200,
    description: 'Market making pause queued.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async pauseMarketMaking(
    @Param('orderId') orderId: string,
    @Body() body: StopMarketMakingDto,
  ) {
    this.logger.log(`Pause market making requested: orderId=${orderId}`);

    await this.userOrdersService.pauseMarketMaking(body.userId, orderId);

    return { ok: true };
  }

  @Post('/market-making/:orderId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume market making (mark created and start)' })
  @ApiResponse({
    status: 200,
    description: 'Market making resume queued.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async resumeMarketMaking(
    @Param('orderId') orderId: string,
    @Body() body: StopMarketMakingDto,
  ) {
    this.logger.log(`Resume market making requested: orderId=${orderId}`);

    await this.userOrdersService.resumeMarketMaking(body.userId, orderId);

    return { ok: true };
  }

  @Post('/market-making/:orderId/exit-withdrawal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exit market making by withdrawing back to user Mixin',
  })
  @ApiResponse({
    status: 200,
    description: 'Market making exit withdrawal queued.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async exitMarketMaking(
    @Param('orderId') orderId: string,
    @Body() body: ExitMarketMakingDto,
  ) {
    this.logger.log(`Exit withdrawal requested: orderId=${orderId}`);

    await this.userOrdersService.exitMarketMaking(body.userId, orderId);

    return { ok: true };
  }

  @Get('/market-making/history/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all market making history by user' })
  @ApiResponse({
    status: 200,
    description: 'All market making history of user',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async getUserOrders(
    @Param('userId') userId: string,
  ): Promise<MarketMakingHistory[]> {
    return await this.userOrdersService.getUserOrders(userId);
  }

  // @Get('/market-making/history/instance/:id')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Get market making history by strategy instance id' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Market making history of strategy instance',
  // })
  // @ApiResponse({ status: 400, description: 'Bad request.' })
  // async getMarketMakingHistoryByInstanceId(
  //   @Param('id') id: string,
  // ): Promise<MarketMakingHistory[]> {
  //   return await this.userOrdersService.getMarketMakingHistoryByStrategyInstanceId(
  //     id,
  //   );
  // }
}
