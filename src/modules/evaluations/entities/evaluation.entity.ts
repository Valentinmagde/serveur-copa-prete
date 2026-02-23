import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessPlan } from '../../business-plans/entities/business-plan.entity';
import { Evaluator } from './evaluator.entity';
import { EvaluationAssignment } from './evaluation-assignment.entity';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BusinessPlan)
  @JoinColumn({ name: 'business_plan_id' })
  businessPlan: BusinessPlan;

  @Column({ name: 'business_plan_id' })
  businessPlanId: number;

  @ManyToOne(() => Evaluator)
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: Evaluator;

  @Column({ name: 'evaluator_id' })
  evaluatorId: number;

  @ManyToOne(() => EvaluationAssignment)
  @JoinColumn({ name: 'assignment_id' })
  assignment: EvaluationAssignment;

  @Column({ name: 'assignment_id', nullable: true })
  assignmentId: number;

  @Column({ name: 'economic_viability_score', type: 'int', nullable: true })
  economicViabilityScore: number;

  @Column({ name: 'innovation_score', type: 'int', nullable: true })
  innovationScore: number;

  @Column({ name: 'quality_score', type: 'int', nullable: true })
  qualityScore: number;

  @Column({
    name: 'implementation_capacity_score',
    type: 'int',
    nullable: true,
  })
  implementationCapacityScore: number;

  @Column({ name: 'social_impact_score', type: 'int', nullable: true })
  socialImpactScore: number;

  @Column({ name: 'environmental_impact_score', type: 'int', nullable: true })
  environmentalImpactScore: number;

  @Column({ name: 'bonus_points', default: 0 })
  bonusPoints: number;

  @Column({ name: 'total_score', type: 'int', nullable: true })
  totalScore: number;

  @Column({ name: 'global_comment', type: 'text', nullable: true })
  globalComment: string;

  @Column({ type: 'text', nullable: true })
  strengths: string;

  @Column({ type: 'text', nullable: true })
  weaknesses: string;

  @Column({ nullable: true })
  recommendation: string;

  @Column({
    name: 'evaluation_date',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  evaluationDate: Date;

  @Column({ name: 'is_final_evaluation', default: false })
  isFinalEvaluation: boolean;

  @Column({ name: 'conflict_of_interest_declared', default: false })
  conflictOfInterestDeclared: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
