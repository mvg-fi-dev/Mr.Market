import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueIndexCampaignParticipation1771461480610 implements MigrationInterface {
  name = 'AddUniqueIndexCampaignParticipation1771461480610';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotency for joining campaigns: one participation per (userId, campaignId, orderId).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_campaign_participation_user_campaign_order" ON "campaign_participation" ("userId", "campaignId", "orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_campaign_participation_user_campaign_order"`,
    );
  }
}
