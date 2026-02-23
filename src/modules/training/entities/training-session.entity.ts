import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Training } from './training.entity';
import { CopaEdition } from '../../reference/entities/copa-edition.entity';
import { Trainer } from './trainer.entity';
import { TrainingParticipation } from './training-participation.entity';

@Entity('training_sessions')
export class TrainingSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_code', unique: true })
  sessionCode: string;

  @ManyToOne(() => Training)
  @JoinColumn({ name: 'training_id' })
  training: Training;

  @Column({ name: 'training_id' })
  trainingId: number;

  @ManyToOne(() => CopaEdition)
  @JoinColumn({ name: 'copa_edition_id' })
  copaEdition: CopaEdition;

  @Column({ name: 'copa_edition_id', nullable: true })
  copaEditionId: number;

  @ManyToOne(() => Trainer)
  @JoinColumn({ name: 'primary_trainer_id' })
  primaryTrainer: Trainer;

  @Column({ name: 'primary_trainer_id', nullable: true })
  primaryTrainerId: number;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  @Column({
    name: 'registration_deadline',
    type: 'timestamptz',
    nullable: true,
  })
  registrationDeadline: Date;

  @Column({ name: 'max_capacity', nullable: true })
  maxCapacity: number;

  @Column({ name: 'current_enrollment', default: 0 })
  currentEnrollment: number;

  @Column({ name: 'physical_location', nullable: true })
  physicalLocation: string;

  @Column({ name: 'meeting_link', nullable: true })
  meetingLink: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ default: 'PLANNED' })
  status: string;

  @OneToMany(
    () => TrainingParticipation,
    (participation) => participation.session,
  )
  participations: TrainingParticipation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
