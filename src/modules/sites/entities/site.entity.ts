import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_site')
export class DoriSite {
  @PrimaryGeneratedColumn()
  site_id: number;

  @Column({ type: 'varchar', length: 255 })
  site_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  site_location: string | null;

  @Column({ type: 'text', nullable: true })
  site_logo_url: string | null;

  @Column({ type: 'varchar', length: 50, default: 'public' })
  site_type: 'public' | 'private';

  @Column({ type: 'varchar', length: 64, default: 'Africa/Tunis' })
  timezone: string;

  @Column({ type: 'char', length: 3, default: 'TND' })
  default_currency: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  // RDV defaults
  @Column({ type: 'boolean', default: false })
  default_appointments_enabled: boolean;

  @Column({ type: 'int', default: 15 })
  default_appointment_slot_duration: number;

  @Column({ type: 'int', default: 1 })
  default_slot_capacity: number;

  @Column({ type: 'time', default: '08:00' })
  default_working_hours_start: string;

  @Column({ type: 'time', default: '17:00' })
  default_working_hours_end: string;

  @Column({ type: 'time', nullable: true, default: '12:00' })
  default_break_start: string | null;

  @Column({ type: 'time', nullable: true, default: '14:00' })
  default_break_end: string | null;

  @Column({ type: 'int', default: 60 })
  default_late_tolerance_minutes: number;

  // Priority score defaults
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  default_base_weight_walkin: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 60 })
  default_base_weight_appointment: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  default_escalation_rate_walkin: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  default_escalation_rate_appointment: number;

  // Closure defaults
  @Column({ type: 'boolean', default: false })
  default_carry_over_waiting: boolean;

  @Column({ type: 'varchar', length: 20, default: 'close_all' })
  default_daily_reset_mode: 'close_all' | 'close_served_only';

  @Column({ type: 'time', default: '03:00' })
  default_daily_reset_time: string;

  @Column({ type: 'varchar', length: 10, default: 'fr' })
  default_locale: string;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
