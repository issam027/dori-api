import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_notification')
export class DoriNotification {
  @PrimaryGeneratedColumn('uuid')
  notification_id: string;

  @Column({ type: 'uuid', nullable: true })
  registration_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_installation_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_registration_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'direct' })
  dispatch_route: 'direct' | 'cloud_relay' | 'disabled_offline';

  @Column({ type: 'uuid', nullable: true })
  rule_id: string | null;

  @Column({ type: 'varchar', length: 20 })
  channel: 'sms' | 'email';

  @Column({ type: 'varchar', length: 20 })
  notification_type: 'welcome' | 'threshold';

  @Column({ type: 'varchar', length: 10 })
  locale: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient: string | null;

  @Column({ type: 'text', nullable: true })
  notification_content: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  notification_status:
    | 'pending'
    | 'processing'
    | 'sent'
    | 'delivered'
    | 'failed'
    | 'skipped_offline';

  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  provider_message_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'int', default: 0 })
  attempt_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
