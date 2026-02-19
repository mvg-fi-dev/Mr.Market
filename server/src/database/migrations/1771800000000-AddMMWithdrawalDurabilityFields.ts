import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMMWithdrawalDurabilityFields1771800000000
  implements MigrationInterface
{
  name = 'AddMMWithdrawalDurabilityFields1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Persist withdrawal tx ids/hashes for crash-safe retries and idempotency.
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" ADD COLUMN "baseWithdrawalTxId" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" ADD COLUMN "quoteWithdrawalTxId" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" ADD COLUMN "baseWithdrawalTxHash" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" ADD COLUMN "quoteWithdrawalTxHash" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" DROP COLUMN "quoteWithdrawalTxHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" DROP COLUMN "baseWithdrawalTxHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" DROP COLUMN "quoteWithdrawalTxId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_making_payment_state" DROP COLUMN "baseWithdrawalTxId"`,
    );
  }
}
