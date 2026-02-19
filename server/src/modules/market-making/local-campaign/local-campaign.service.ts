import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Campaign } from 'src/common/entities/campaign/campaign.entity';
import { CampaignParticipation } from 'src/common/entities/campaign/campaign-participation.entity';
import { CustomLogger } from 'src/modules/infrastructure/logger/logger.service';
import { Repository } from 'typeorm';

@Injectable()
export class LocalCampaignService {
  private readonly logger = new CustomLogger(LocalCampaignService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignParticipation)
    private readonly participationRepository: Repository<CampaignParticipation>,
    @InjectQueue('local-campaigns') private readonly campaignQueue: Queue,
  ) {}

  async createCampaign(data: Partial<Campaign>): Promise<Campaign> {
    const campaign = this.campaignRepository.create({
      ...data,
      status: 'active',
    });

    return this.campaignRepository.save(campaign);
  }

  async joinCampaign(
    userId: string,
    campaignId: string,
    orderId?: string,
  ): Promise<CampaignParticipation> {
    // Idempotency: MM flows can be retried / re-queued at-least-once.
    // For a given (userId, campaignId, orderId) we should return the existing participation.
    const existing = await this.participationRepository.findOne({
      where: {
        userId,
        campaignId,
        orderId,
      },
    });

    if (existing) {
      return existing;
    }

    const participation = this.participationRepository.create({
      userId,
      campaignId,
      orderId,
      status: 'joined',
    });

    try {
      return await this.participationRepository.save(participation);
    } catch (error) {
      // Best-effort unique-violation handling if the underlying DB schema has a unique index.
      const message = String((error as any)?.message || '').toLowerCase();
      const code = (error as any)?.code;
      const isUnique = code === '23505' || message.includes('duplicate');

      if (isUnique) {
        const after = await this.participationRepository.findOne({
          where: {
            userId,
            campaignId,
            orderId,
          },
        });
        if (after) {
          return after;
        }
      }

      throw error;
    }
  }

  async monitorCampaigns() {
    const activeCampaigns = await this.campaignRepository.find({
      where: { status: 'active' },
    });

    for (const campaign of activeCampaigns) {
      await this.campaignQueue.add('check_campaign_status', {
        campaignId: campaign.id,
      });
    }
  }

  async findById(id: string): Promise<Campaign> {
    return this.campaignRepository.findOneBy({ id });
  }

  async updateCampaign(id: string, update: Partial<Campaign>) {
    await this.campaignRepository.update(id, update);
  }

  async getParticipations(
    campaignId: string,
  ): Promise<CampaignParticipation[]> {
    return this.participationRepository.find({ where: { campaignId } });
  }

  async updateParticipation(
    id: string,
    update: Partial<CampaignParticipation>,
  ) {
    await this.participationRepository.update(id, update);
  }
}
