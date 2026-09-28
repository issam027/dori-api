import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dori_user_session')
export class DoriUserSession {
  @PrimaryGeneratedColumn()
  session_id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  refresh_token_hash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  issued_at: Date;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  revoked_reason:
    | 'logout'
    | 'rotation'
    | 'account_disabled'
    | 'password_changed'
    | 'admin'
    | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent: string | null;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;
}
