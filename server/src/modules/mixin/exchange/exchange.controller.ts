import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';

import {
  ExchangeDepositRequestDto,
  ExchangeDepositsRequestDto,
  ExchangeWithdrawalRequestDto,
} from './exchange.dto';
import { ExchangeService } from './exchange.service';

// This API is used for admin page to do rebalance
@ApiTags('Exchange')
@Controller('exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  private readonly logger = new CustomLogger(ExchangeController.name);

  constructor(private readonly exchangeService: ExchangeService) {}

  @Post('/withdrawal/create')
  @ApiOperation({ summary: 'Create withdrawal with api key' })
  @ApiResponse({ status: 200, description: 'Create withdrawal' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async createWithdrawal(@Body() data: ExchangeWithdrawalRequestDto) {
    try {
      return this.exchangeService.createWithdrawalFromRequest(data);
    } catch (e) {
      this.logger.error(`Create withdrawal error: ${e.message}`);
    }
  }

  @Post('/deposit/create')
  @ApiOperation({ summary: 'Get deposit address with api key' })
  @ApiResponse({ status: 200, description: 'Get deposit address' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getDepositAddress(@Body() data: ExchangeDepositRequestDto) {
    try {
      return this.exchangeService.getDepositAddressFromRequest(data);
    } catch (e) {
      this.logger.error(`Get deposit address error: ${e.message}`);
    }
  }

  @Post('/deposits')
  @ApiOperation({ summary: 'Fetch deposits from exchange (ccxt)' })
  @ApiResponse({ status: 200, description: 'Deposit history list' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getDeposits(@Body() data: ExchangeDepositsRequestDto) {
    try {
      return await this.exchangeService.getDepositsFromRequest(data);
    } catch (e) {
      this.logger.error(`Get deposits error: ${e.message}`);
    }
  }

  @Get('/spot-orders')
  async getAllSpotOrders() {
    return await this.exchangeService.getAllSpotOrders();
  }
}
