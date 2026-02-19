import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTradeExchangeColumn1771600000000 implements MigrationInterface {
  name = 'AddTradeExchangeColumn1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Improve auditability/replayability: persist which exchange a trade was executed on.
    // SQLite requires DEFAULT for NOT NULL when adding a column.
    await queryRunner.query(
      `ALTER TABLE "trade" ADD COLUMN "exchange" varchar NOT NULL DEFAULT ('')`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trade_exchange" ON "trade" ("exchange")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: SQLite has limited ALTER TABLE support; dropping columns may fail.
    // We still keep the down migration for environments that support it.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_exchange"`);

    // Best-effort: for SQLite this will likely throw; callers can ignore on SQLite.
    await queryRunner.query(`ALTER TABLE "trade" DROP COLUMN "exchange"`);
  }
}
