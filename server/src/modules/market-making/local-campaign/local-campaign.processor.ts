import { Process, Processor } from '@nestjs/bull';
import BigNumber from 'bignumber.js';
import { Job } from 'bull';
import { formatAuditLogContext } from 'src/modules/infrastructure/logger/log-context';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';

import { LocalCampaignService } from './local-campaign.service';

@Processor('local-campaigns')
export class LocalCampaignProcessor {
  private readonly logger = new CustomLogger(LocalCampaignProcessor.name);

  constructor(private readonly campaignService: LocalCampaignService) {}

  @Process('check_campaign_status')
  async handleCheckCampaignStatus(job: Job<{ campaignId: string }>) {
    const { campaignId } = job.data;

    this.logger.log(
      `${formatAuditLogContext({
        job,
        campaignId,
      })} Checking campaign status`,
    );

    const campaign = await this.campaignService.findById(campaignId);

    if (!campaign) {
      this.logger.error(
        `${formatAuditLogContext({
          job,
          campaignId,
        })} Campaign not found`,
      );

      return;
    }

    // Check if campaign has ended
    if (new Date() > campaign.endTime && campaign.status === 'active') {
      this.logger.log(
        `${formatAuditLogContext({
          job,
          campaignId,
        })} Campaign ended. Distributing rewards...`,
      );
      await this.campaignService.updateCampaign(campaignId, {
        status: 'completed',
      });

      // Trigger reward distribution
      await this.distributeRewards(campaignId);
    }
  }

  private async distributeRewards(campaignId: string) {
    const traceId = `local-campaign:${campaignId}`;
    const campaign = await this.campaignService.findById(campaignId);
    const participations = await this.campaignService.getParticipations(
      campaignId,
    );

    if (participations.length === 0) {
      this.logger.warn(
        `${formatAuditLogContext({
          traceId,
          campaignId,
        })} No participants for campaign`,
      );

      return;
    }

    const totalContribution = participations.reduce(
      (sum, p) => sum.plus(p.contributionAmount ?? 0),
      new BigNumber(0),
    );

    if (totalContribution.isZero()) {
      this.logger.warn(
        `${formatAuditLogContext({
          traceId,
          campaignId,
        })} Total contribution is 0 for campaign`,
      );

      return;
    }

    for (const p of participations) {
      const contribution = new BigNumber(p.contributionAmount ?? 0);
      const share = contribution.dividedBy(totalContribution);
      const reward = share.multipliedBy(campaign.totalReward ?? 0);

      await this.campaignService.updateParticipation(p.id, {
        rewardAmount: reward.toNumber(),
        status: 'rewarded',
      });

      this.logger.log(
        `${formatAuditLogContext({
          traceId,
          campaignId,
        })} Rewarded user ${p.userId} with ${reward.toString()} ${
          campaign.rewardToken
        }`,
      );
    }
  }
}
