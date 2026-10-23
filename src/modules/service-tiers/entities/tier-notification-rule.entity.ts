import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_queue_tier_notification_rule')
export class DoriTierNotificationRule {
  @PrimaryGeneratedColumn('uuid')
  rule_id: string;

  @Column({ type: 'uuid' })
  queue_id: string;

  @Column({ type: 'uuid' })
  tier_id: string;

  @Column({ type: 'varchar', length: 20 })
  notification_type: 'welcome' | 'threshold';

  @Column({ type: 'varchar', length: 20 })
  channel: 'sms' | 'email';

  @Column({ type: 'int', nullable: true })
  threshold_position: number | null;

  @Column({ type: 'int', nullable: true })
  threshold_minutes: number | null;

  @Column({ type: 'boolean', default: false })
  include_tracking_link: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by_user_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
