import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_user')
export class DoriUser {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'human',
  })
  user_type: 'human' | 'kiosk';

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'varchar', length: 10, default: 'fr' })
  language_preference: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_login: Date | null;

  @Column({ type: 'int', default: 0 })
  failed_attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  password_changed_at: Date | null;

  @Column({ type: 'boolean', default: false })
  must_change_password: boolean;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
