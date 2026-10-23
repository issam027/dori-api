import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('dori_user_site_assignment')
export class DoriUserSite {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @PrimaryColumn({ type: 'uuid' })
  site_id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'assigned_at' })
  assigned_at: Date;

  @Column({ type: 'uuid', nullable: true })
  assigned_by_user_id: string | null;
}
