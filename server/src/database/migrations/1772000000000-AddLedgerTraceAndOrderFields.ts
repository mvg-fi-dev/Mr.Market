import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLedgerTraceAndOrderFields1772000000000
  implements MigrationInterface
{
  name = 'AddLedgerTraceAndOrderFields1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Improve auditability/replayability: make traceId/orderId queryable on ledger entries.
    // SQLite requires DEFAULT for NOT NULL when adding a column.
    await queryRunner.query(
      `ALTER TABLE "ledger_entry" ADD COLUMN "traceId" varchar NOT NULL DEFAULT ('')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entry" ADD COLUMN "orderId" varchar NOT NULL DEFAULT ('')`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ledger_entry_traceId" ON "ledger_entry" ("traceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ledger_entry_orderId" ON "ledger_entry" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_entry_orderId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_entry_traceId"`);

    // Best-effort: SQLite has limited ALTER TABLE; this may fail.
    await queryRunner.query(`ALTER TABLE "ledger_entry" DROP COLUMN "orderId"`);
    await queryRunner.query(`ALTER TABLE "ledger_entry" DROP COLUMN "traceId"`);
  }
}
