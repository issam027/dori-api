import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_person_note')
export class DoriPersonNote {
  @PrimaryGeneratedColumn('uuid')
  note_id: string;

  @Column({ type: 'uuid' })
  person_id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid' })
  created_by_user_id: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by_user_id: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
