import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';

import { MetricsService } from './metrics.service';

@ApiTags('Trading Engine')
@Controller('metrics')
export class MetricsController {
  private readonly logger = new CustomLogger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get metrics' })
  @ApiResponse({ status: 200, description: 'Metrics' })
  getMetrics() {
    return this.metricsService.getStrategyMetrics();
  }

  @Get('execution-report')
  @ApiOperation({
    summary: 'Get execution report v0 (per orderId + time window)',
  })
  @ApiResponse({ status: 200, description: 'Execution report bundle' })
  getExecutionReport(
    @Query('orderId') orderId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!orderId) {
      return {
        ok: false,
        error: 'Missing required query param: orderId',
      };
    }

    return this.metricsService.getExecutionReport({ orderId, from, to });
  }
}
