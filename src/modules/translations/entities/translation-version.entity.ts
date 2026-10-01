import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('dori_translation_version')
export class DoriTranslationVersion {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  category: 'ihm' | 'sms' | 'error';

  @Column({ type: 'int', default: 1 })
  version: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
