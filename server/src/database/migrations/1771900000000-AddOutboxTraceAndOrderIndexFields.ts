import { MigrationInterface, QueryRunner } from typeorm;

export class AddOutboxTraceAndOrderIndexFields1771900000000
  implements MigrationInterface
{
  name = AddOutboxTraceAndOrderIndexFields1771900000000;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Improve auditability/replayability: make traceId/orderId queryable without LIKE on JSON.
    // SQLite requires DEFAULT for NOT NULL when adding a column.
    await queryRunner.query(
      `ALTER TABLE "outbox_event" ADD COLUMN "traceId" varchar NOT NULL DEFAULT ()`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_event" ADD COLUMN "orderId" varchar NOT NULL DEFAULT ()`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_event_traceId" ON "outbox_event" ("traceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_event_orderId" ON "outbox_event" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outbox_event_orderId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outbox_event_traceId"`);

    // Best-effort: SQLite has limited ALTER TABLE; this may fail.
    await queryRunner.query(`ALTER TABLE "outbox_event" DROP COLUMN "orderId"`);
    await queryRunner.query(`ALTER TABLE "outbox_event" DROP COLUMN "traceId"`);
  }
}
