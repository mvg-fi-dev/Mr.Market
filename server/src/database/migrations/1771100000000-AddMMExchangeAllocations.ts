import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMMExchangeAllocations1771100000000 implements MigrationInterface {
  name = 'AddMMExchangeAllocations1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mm_exchange_allocations" (
        "id" varchar PRIMARY KEY NOT NULL,
        "orderId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        "exchange" varchar NOT NULL,
        "baseAssetId" varchar NOT NULL,
        "baseSymbol" varchar NOT NULL,
        "baseAllocatedAmount" varchar NOT NULL DEFAULT (0),
        "quoteAssetId" varchar NOT NULL,
        "quoteSymbol" varchar NOT NULL,
        "quoteAllocatedAmount" varchar NOT NULL DEFAULT (0),
        "state" varchar NOT NULL DEFAULT ('created'),
        "createdAt" varchar NOT NULL,
        "updatedAt" varchar NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mm_exchange_allocations_orderId"
      ON "mm_exchange_allocations" ("orderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mm_exchange_allocations_orderId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "mm_exchange_allocations"`);
  }
}
