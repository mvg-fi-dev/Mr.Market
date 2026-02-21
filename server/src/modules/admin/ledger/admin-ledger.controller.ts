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
  ListLedgerEntriesQueryDto,
  ListLedgerEntriesResponseDto,
} from './admin-ledger.dto';
import { AdminLedgerService } from './admin-ledger.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/ledger')
export class AdminLedgerController {
  constructor(private readonly adminLedgerService: AdminLedgerService) {}

  @Get('/')
  @ApiOperation({
    summary: 'List balance ledger entries (ops/audit)',
    description:
      'Durable ledger entries with optional traceId/orderId for lifecycle reconstruction.',
  })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'assetId', required: false })
  @ApiQuery({ name: 'traceId', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'refType', required: false })
  @ApiQuery({ name: 'refId', required: false })
  @ApiQuery({ name: 'since', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of ledger entries (most recent first)',
    type: ListLedgerEntriesResponseDto,
  })
  async list(
    @Query() query: ListLedgerEntriesQueryDto,
  ): Promise<ListLedgerEntriesResponseDto> {
    return await this.adminLedgerService.listLedgerEntries(query);
  }
}
