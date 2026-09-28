import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_translation')
export class DoriTranslation {
  @PrimaryGeneratedColumn()
  translation_id: number;

  @Column({ type: 'varchar', length: 150 })
  translation_key: string;

  @Column({ type: 'varchar', length: 20, default: 'ihm' })
  category: 'ihm' | 'sms' | 'error';

  @Column({ type: 'varchar', length: 10 })
  locale: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', array: true, nullable: true })
  expected_params: string[] | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
