import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMMExchangeAllocationExitFields1771200000000
  implements MigrationInterface
{
  name = 'AddMMExchangeAllocationExitFields1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" ADD COLUMN "exitWithdrawalStartedAt" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" ADD COLUMN "exitExpectedBaseTxHash" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" ADD COLUMN "exitExpectedQuoteTxHash" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" DROP COLUMN "exitExpectedQuoteTxHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" DROP COLUMN "exitExpectedBaseTxHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mm_exchange_allocations" DROP COLUMN "exitWithdrawalStartedAt"`,
    );
  }
}
