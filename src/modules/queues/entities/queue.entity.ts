import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_site_queue_thread')
export class DoriQueue {
  @PrimaryGeneratedColumn()
  queue_id: number;

  @Column({ type: 'varchar', length: 10 })
  queue_code: string;

  @Column({ type: 'int' })
  site_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  queue_name: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'int', default: 10 })
  average_wait_time: number;

  @Column({ type: 'int', default: 1 })
  thread_count: number;

  // Overrides (null = inherit from site)
  @Column({ type: 'char', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'boolean', nullable: true })
  appointments_enabled: boolean | null;

  @Column({ type: 'int', nullable: true })
  appointment_slot_duration: number | null;

  @Column({ type: 'int', nullable: true })
  slot_capacity: number | null;

  @Column({ type: 'time', nullable: true })
  working_hours_start: string | null;

  @Column({ type: 'time', nullable: true })
  working_hours_end: string | null;

  @Column({ type: 'time', nullable: true })
  break_start: string | null;

  @Column({ type: 'time', nullable: true })
  break_end: string | null;

  @Column({ type: 'int', nullable: true })
  late_tolerance_minutes: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  base_weight_walkin: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  base_weight_appointment: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  escalation_rate_walkin: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  escalation_rate_appointment: number | null;

  @Column({ type: 'boolean', nullable: true })
  carry_over_waiting: boolean | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  daily_reset_mode: 'close_all' | 'close_served_only' | null;

  @Column({ type: 'time', nullable: true })
  daily_reset_time: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  locale: string | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
