import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMMAllocationExitIssuedFields1772100000000
  implements MigrationInterface
{
  name = 'AddMMAllocationExitIssuedFields1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" ADD COLUMN "exitBaseIssuedAt" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" ADD COLUMN "exitQuoteIssuedAt" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" DROP COLUMN "exitQuoteIssuedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" DROP COLUMN "exitBaseIssuedAt"`,
    );
  }
}
