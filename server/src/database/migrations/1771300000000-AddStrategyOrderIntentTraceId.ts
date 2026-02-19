import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStrategyOrderIntentTraceId1771300000000
  implements MigrationInterface
{
  name = 'AddStrategyOrderIntentTraceId1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "strategy_order_intent" ADD COLUMN "traceId" varchar`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_strategy_order_intent_trace_id" ON "strategy_order_intent" ("traceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_strategy_order_intent_trace_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "strategy_order_intent" DROP COLUMN "traceId"`,
    );
  }
}
