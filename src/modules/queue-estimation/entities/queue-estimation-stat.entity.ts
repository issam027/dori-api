import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_queue_estimation_stats')
export class DoriQueueEstimationStat {
  @PrimaryGeneratedColumn('uuid')
  estimation_stats_id: string;

  @Column({ type: 'uuid' }) site_id: string;
  @Column({ type: 'uuid' }) queue_id: string;
  @Column({ type: 'date' }) activity_date: string;
  @Column({ type: 'timestamptz' }) window_started_at: Date;
  @Column({ type: 'timestamptz' }) window_ended_at: Date;
  @Column({ type: 'int', nullable: true }) cycle_p50_minutes: number | null;
  @Column({ type: 'int', nullable: true }) cycle_p65_minutes: number | null;
  @Column({ type: 'int', nullable: true }) cycle_p90_minutes: number | null;
  @Column({ type: 'int', nullable: true }) wait_p50_minutes: number | null;
  @Column({ type: 'int', nullable: true }) wait_p65_minutes: number | null;
  @Column({ type: 'int', nullable: true }) wait_p90_minutes: number | null;
  @Column({ type: 'int' }) sample_size: number;
  @Column({ type: 'boolean', default: false }) is_reliable: boolean;
  @Column({ type: 'timestamptz' }) calculated_at: Date;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
