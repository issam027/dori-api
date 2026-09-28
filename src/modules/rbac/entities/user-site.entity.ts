import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('dori_user_site')
export class DoriUserSite {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'int' })
  site_id: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'assigned_at' })
  assigned_at: Date;

  @Column({ type: 'int', nullable: true })
  assigned_by_user_id: number | null;
}
