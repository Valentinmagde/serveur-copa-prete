import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TrainingSession } from './training-session.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';

@Entity('training_participations')
export class TrainingParticipation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TrainingSession)
  @JoinColumn({ name: 'session_id' })
  session: TrainingSession;

  @Column({ name: 'session_id' })
  sessionId: number;

  @ManyToOne(() => Beneficiary)
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary: Beneficiary;

  @Column({ name: 'beneficiary_id' })
  beneficiaryId: number;

  @Column({
    name: 'registration_date',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  registrationDate: Date;

  @Column({ name: 'attendance_status', default: 'REGISTERED' })
  attendanceStatus: string;

  @Column({ name: 'attendance_date', type: 'timestamptz', nullable: true })
  attendanceDate: Date;

  @Column({ name: 'evaluation_score', nullable: true })
  evaluationScore: number;

  @Column({ name: 'has_validated', default: false })
  hasValidated: boolean;

  @Column({ name: 'certificate_obtained', default: false })
  certificateObtained: boolean;

  @Column({
    name: 'certificate_obtained_at',
    type: 'timestamptz',
    nullable: true,
  })
  certificateObtainedAt: Date;

  @Column({ name: 'certificate_url', nullable: true })
  certificateUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
