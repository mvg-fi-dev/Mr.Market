import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

import {
  ListOutboxEventsQueryDto,
  ListOutboxEventsResponseDto,
} from './admin-outbox.dto';
import { AdminOutboxService } from './admin-outbox.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/outbox')
export class AdminOutboxController {
  constructor(private readonly adminOutboxService: AdminOutboxService) {}

  @Get('/')
  @ApiOperation({ summary: 'List durable outbox events (ops/audit)' })
  @ApiQuery({ name: 'topic', required: false })
  @ApiQuery({ name: 'aggregateType', required: false })
  @ApiQuery({ name: 'aggregateId', required: false })
  @ApiQuery({ name: 'traceId', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'since', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of outbox events (most recent first)',
    type: ListOutboxEventsResponseDto,
  })
  async list(
    @Query() query: ListOutboxEventsQueryDto,
  ): Promise<ListOutboxEventsResponseDto> {
    return await this.adminOutboxService.listOutboxEvents(query);
  }
}
