import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_tier_notification_rule')
export class DoriTierNotificationRule {
  @PrimaryGeneratedColumn()
  rule_id: number;

  @Column({ type: 'int' })
  queue_id: number;

  @Column({ type: 'int' })
  tier_id: number;

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

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
