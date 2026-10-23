import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('dori_user_queue_assignment')
export class DoriUserQueue {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @PrimaryColumn({ type: 'uuid' })
  queue_id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'assigned_at' })
  assigned_at: Date;

  @Column({ type: 'uuid', nullable: true })
  assigned_by_user_id: string | null;
}
