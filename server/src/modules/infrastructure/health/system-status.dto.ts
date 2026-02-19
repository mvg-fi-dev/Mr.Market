import { ApiProperty } from '@nestjs/swagger';

export class SystemQueueHealthDto {
  @ApiProperty({ example: 'market-making' })
  name: string;

  @ApiProperty({ example: false })
  isPaused: boolean;

  @ApiProperty({ example: 0 })
  waiting: number;

  @ApiProperty({ example: 0 })
  active: number;

  @ApiProperty({ example: 0 })
  completed: number;

  @ApiProperty({ example: 0 })
  failed: number;

  @ApiProperty({ example: 0 })
  delayed: number;
}

export class TickHealthDto {
  @ApiProperty({ example: true })
  running: boolean;

  @ApiProperty({ example: 1000 })
  tickSizeMs: number;

  @ApiProperty({ nullable: true, example: 1700000000000 })
  lastTickAtMs: number | null;

  @ApiProperty({ nullable: true, example: '2026-02-19T02:00:00.000Z' })
  lastTickAt: string | null;

  @ApiProperty({ example: 0 })
  tickCount: number;

  @ApiProperty({ example: true })
  recentlyTicked: boolean;
}

export class SystemStatusDto {
  @ApiProperty({ example: '2026-02-19T02:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ type: SystemQueueHealthDto })
  queues: {
    snapshots: SystemQueueHealthDto;
    marketMaking: SystemQueueHealthDto;
  };

  @ApiProperty({ type: TickHealthDto })
  tick: TickHealthDto;

  @ApiProperty({ type: [String] })
  issues: string[];
}
