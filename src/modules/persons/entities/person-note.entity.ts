import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_person_note')
export class DoriPersonNote {
  @PrimaryGeneratedColumn()
  note_id: number;

  @Column({ type: 'int' })
  person_id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
