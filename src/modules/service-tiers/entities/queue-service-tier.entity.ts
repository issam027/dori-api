import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_queue_service_tier')
export class DoriQueueServiceTier {
  @PrimaryColumn({ type: 'uuid' })
  queue_id: string;

  @PrimaryColumn({ type: 'uuid' })
  tier_id: string;

  @Column({ type: 'numeric', precision: 10, scale: 3, default: 0 })
  price: number;

  @Column({ type: 'char', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

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
