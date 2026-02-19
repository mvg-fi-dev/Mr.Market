/**
 * Tracks user participation and reward state within each campaign.
 * Used by app.module and modules/market-making/local-campaign services/controllers.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Index(['userId', 'campaignId', 'orderId'], { unique: true })
export class CampaignParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  campaignId: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  @Index()
  orderId: string; // Link to specific market making order if applicable

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  contributionAmount: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  rewardAmount: number;

  @Column()
  status: string; // 'joined', 'rewarded'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
