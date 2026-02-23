import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TrainingSession } from './training-session.entity';

@Entity('trainings')
export class Training {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  objectives: string;

  @Column({ name: 'duration_hours', nullable: true })
  durationHours: number;

  @Column({ nullable: true })
  format: string;

  @Column({ name: 'detailed_program', type: 'text', nullable: true })
  detailedProgram: string;

  @Column({ type: 'text', nullable: true })
  prerequisites: string;

  @Column({ name: 'target_audience', type: 'text', nullable: true })
  targetAudience: string;

  @Column({ name: 'is_copa_mandatory', default: false })
  isCopaMandatory: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => TrainingSession, (session) => session.training)
  sessions: TrainingSession[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
