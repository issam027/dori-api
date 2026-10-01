import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('dori_queue_counter')
export class DoriQueueCounter {
  @PrimaryColumn({ type: 'int' })
  queue_id: number;

  @PrimaryColumn({ type: 'date' })
  business_date: string;

  @Column({ type: 'int', default: 0 })
  last_number: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
