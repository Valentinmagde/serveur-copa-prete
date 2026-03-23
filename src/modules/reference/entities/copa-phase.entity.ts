import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CopaEdition } from './copa-edition.entity';

export enum PhaseCode {
  REGISTRATION = 'REGISTRATION',
  PRE_SELECTION = 'PRE_SELECTION',
  TRAINING = 'TRAINING',
  BUSINESS_PLAN_SUBMISSION = 'BUSINESS_PLAN_SUBMISSION',
  EVALUATION = 'EVALUATION',
  SELECTION = 'SELECTION',
  AWARDING = 'AWARDING',
  MENTORING = 'MENTORING',
  MONITORING = 'MONITORING',
}

@Entity('copa_phases')
export class CopaPhase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CopaEdition)
  @JoinColumn({ name: 'copa_edition_id' })
  copaEdition: CopaEdition;

  @Column({ name: 'copa_edition_id' })
  copaEditionId: number;

  @Column({
    name: 'phase_code',
    type: 'varchar',
    length: 50,
    enum: PhaseCode,
  })
  phaseCode: PhaseCode;

  @Column({ name: 'phase_name', type: 'varchar', length: 100 })
  phaseName: string;

  @Column({
    name: 'phase_name_fr',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  phaseNameFr: string;

  @Column({
    name: 'phase_name_rn',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  phaseNameRn: string;

  @Column({ name: 'phase_description', type: 'text', nullable: true })
  phaseDescription: string;

  @Column({ name: 'phase_description_fr', type: 'text', nullable: true })
  phaseDescriptionFr: string;

  @Column({ name: 'phase_description_rn', type: 'text', nullable: true })
  phaseDescriptionRn: string;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', type: 'integer', nullable: true })
  displayOrder: number;

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ name: 'auto_transition', type: 'boolean', default: false })
  autoTransition: boolean;

  @Column({ name: 'transition_days', type: 'integer', nullable: true })
  transitionDays: number;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
