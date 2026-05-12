import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ContactStatus = 'PENDING' | 'READ' | 'RESPONDED' | 'CLOSED';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous!: boolean;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column()
  subject!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status!: ContactStatus;

  @Column({ type: 'text', nullable: true })
  response!: string | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
