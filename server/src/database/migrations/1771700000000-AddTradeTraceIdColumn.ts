import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTradeTraceIdColumn1771700000000
  implements MigrationInterface
{
  name = 'AddTradeTraceIdColumn1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Improve auditability/replayability: persist traceId for trade executions.
    // SQLite requires DEFAULT for NOT NULL when adding a column.
    await queryRunner.query(
      `ALTER TABLE "trade" ADD COLUMN "traceId" varchar NOT NULL DEFAULT ('')`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trade_traceId" ON "trade" ("traceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_traceId"`);

    // Best-effort: SQLite has limited ALTER TABLE; this may fail.
    await queryRunner.query(`ALTER TABLE "trade" DROP COLUMN "traceId"`);
  }
}
