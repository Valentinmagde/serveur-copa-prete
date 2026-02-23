import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';
import { CopaEdition } from '../../reference/entities/copa-edition.entity';

@Entity('mentorships')
export class Mentorship {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'mentor_id' })
  mentor: User;

  @Column({ name: 'mentor_id' })
  mentorId: number;

  @ManyToOne(() => Beneficiary)
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary: Beneficiary;

  @Column({ name: 'beneficiary_id' })
  beneficiaryId: number;

  @ManyToOne(() => CopaEdition)
  @JoinColumn({ name: 'copa_edition_id' })
  copaEdition: CopaEdition;

  @Column({ name: 'copa_edition_id' })
  copaEditionId: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', nullable: true })
  objectives: string;

  @Column({ name: 'meeting_frequency', nullable: true })
  meetingFrequency: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
