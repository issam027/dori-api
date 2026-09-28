import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dori_queue_session')
export class DoriQueueSession {
  @PrimaryGeneratedColumn()
  session_id: number;

  @Column({ type: 'int' })
  queue_id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int', nullable: true })
  thread_number: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  mode: 'active' | 'consultation_only';

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  connected_at: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  last_seen_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  disconnected_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  closure_reason: 'logout' | 'taken_over' | 'daily_reset' | 'forced' | null;

  @Column({ type: 'int', nullable: true })
  closed_by_user_id: number | null;
}
