import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_role')
export class DoriRole {
  @PrimaryGeneratedColumn()
  role_id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  role_name: string;

  @Column({ type: 'int' })
  rank: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
