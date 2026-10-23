import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dori_person')
export class DoriPerson {
  @PrimaryGeneratedColumn('uuid')
  person_id: string;

  @Column({ type: 'uuid' })
  site_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', length: 50 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20 })
  phone_number: string;

  @Column({ type: 'date', nullable: true })
  birth_date: string | null;

  @Column({ type: 'varchar', length: 10, default: 'fr' })
  language_preference: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by_user_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
