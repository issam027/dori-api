import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('dori_user_role')
export class DoriUserRole {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @PrimaryColumn({ type: 'uuid' })
  role_id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'assigned_at' })
  assigned_at: Date;

  @Column({ type: 'uuid', nullable: true })
  assigned_by_user_id: string | null;
}
