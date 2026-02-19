// health.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HealthSummaryDto } from './health.dto';
import { SystemStatusDto } from './system-status.dto';

import { HealthService } from './health.service';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get('/')
  @ApiOperation({ summary: 'Get server health status' })
  @ApiResponse({ status: 200, description: 'Server health', type: HealthSummaryDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getHealth(): Promise<HealthSummaryDto> {
    return await this.healthService.getAllHealth();
  }

  @Get('/ping')
  @ApiOperation({ summary: 'Ping' })
  @ApiResponse({ status: 200, description: 'Pong' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async ping() {
    return this.healthService.ping();
  }

  @Get('/exchange/:name')
  @ApiOperation({ summary: 'Get health by exchange name' })
  @ApiParam({ name: 'name', description: 'Exchange name', required: true })
  @ApiResponse({ status: 200, description: 'Health by exchange' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getHealthByExchange(@Param('name') name: string) {
    return this.healthService.getExchangeHealth(name);
  }

  @Get('/snapshots')
  @ApiOperation({ summary: 'Get snapshot polling queue health status' })
  @ApiResponse({
    status: 200,
    description: 'Snapshot polling queue health with metrics and status',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'warning', 'critical'],
          description: 'Overall health status',
        },
        healthy: { type: 'boolean', description: 'Whether system is healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        queue: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            isPaused: { type: 'boolean' },
            isPollingActive: {
              type: 'boolean',
              description: 'Whether the polling loop is running',
            },
            nextPollJob: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                delay: { type: 'number' },
                timestamp: { type: 'number' },
              },
            },
          },
        },
        metrics: {
          type: 'object',
          properties: {
            waiting: { type: 'number' },
            active: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
            delayed: { type: 'number' },
          },
        },
        issues: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of detected issues',
        },
        recentFailures: {
          type: 'array',
          items: { type: 'object' },
          description: 'Recent failed jobs',
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getSnapshotPollingHealth() {
    return await this.healthService.checkSnapshotPollingHealth();
  }

  @Get('/market-making')
  @ApiOperation({ summary: 'Get market-making queue health status' })
  @ApiResponse({ status: 200, description: 'Market-making queue health' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getMarketMakingQueueHealth() {
    return await this.healthService.checkMarketMakingQueueHealth();
  }

  @Get('/system-status')
  @ApiOperation({ summary: 'Get system status summary (queues + tick loop)' })
  @ApiResponse({ status: 200, description: 'System status', type: SystemStatusDto })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getSystemStatus(): Promise<SystemStatusDto> {
    return await this.healthService.getSystemStatus();
  }
}
