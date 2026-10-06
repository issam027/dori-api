import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_registration')
export class DoriRegistration {
  @PrimaryGeneratedColumn()
  registration_id: number;

  @Column({ type: 'int' })
  person_id: number;

  @Column({ type: 'int' })
  queue_id: number;

  @Column({ type: 'int' })
  tier_id: number;

  @Column({ type: 'date' })
  business_date: string;

  @Column({ type: 'varchar', length: 14 })
  ticket_number: string;

  @Column({ type: 'varchar', length: 20, default: 'walkin' })
  entry_type: 'walkin' | 'appointment';

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_time: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checked_in_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'n/a' })
  appointment_status:
    'n/a' | 'booked' | 'checked_in' | 'rescheduled' | 'cancelled' | 'expired';

  @Column({ type: 'timestamptz' })
  priority_reference_time: Date;

  @Column({ type: 'varchar', length: 20, default: 'waiting' })
  status:
    | 'booked'
    | 'waiting'
    | 'in_progress'
    | 'served'
    | 'no_show'
    | 'expired'
    | 'cancelled';

  @Column({ type: 'int', nullable: true })
  current_session_id: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  called_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  served_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'date', nullable: true })
  carried_over_from_date: string | null;

  @Column({ type: 'uuid', generated: 'uuid' })
  registration_tracking_token: string;

  @Column({ type: 'timestamptz' })
  registration_tracking_token_valid_until: Date;

  @Column({ type: 'varchar', length: 20, default: 'not_applicable' })
  payment_status: 'not_applicable' | 'pending' | 'paid' | 'refunded' | 'failed';

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  payment_amount: number | null;

  @Column({ type: 'char', length: 3, nullable: true })
  payment_currency: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  payment_method: 'cash' | 'card' | 'kiosk_card' | 'external' | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language_preference: string | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
