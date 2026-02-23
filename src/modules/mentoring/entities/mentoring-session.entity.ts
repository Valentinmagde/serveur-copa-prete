import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mentorship } from './mentorship.entity';

@Entity('mentoring_sessions')
export class MentoringSession {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Mentorship)
  @JoinColumn({ name: 'mentorship_id' })
  mentorship: Mentorship;

  @Column({ name: 'mentorship_id' })
  mentorshipId: number;

  @Column({ name: 'session_date', type: 'timestamptz' })
  sessionDate: Date;

  @Column({ name: 'duration_minutes', nullable: true })
  durationMinutes: number;

  @Column({ nullable: true })
  format: string;

  @Column({ name: 'topics_discussed', type: 'text', nullable: true })
  topicsDiscussed: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'next_steps', type: 'text', nullable: true })
  nextSteps: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
