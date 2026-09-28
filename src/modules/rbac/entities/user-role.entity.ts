import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('dori_user_role')
export class DoriUserRole {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'int' })
  role_id: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'assigned_at' })
  assigned_at: Date;

  @Column({ type: 'int', nullable: true })
  assigned_by_user_id: number | null;
}
