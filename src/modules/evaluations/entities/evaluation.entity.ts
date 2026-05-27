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

  // Anciens critères (conservés pour compatibilité)
  @Column({ name: 'economic_viability_score', type: 'int', nullable: true })
  economicViabilityScore: number;

  @Column({ name: 'innovation_score', type: 'int', nullable: true })
  innovationScore: number;

  @Column({ name: 'quality_score', type: 'int', nullable: true })
  qualityScore: number;

  @Column({ name: 'implementation_capacity_score', type: 'int', nullable: true })
  implementationCapacityScore: number;

  @Column({ name: 'social_impact_score', type: 'int', nullable: true })
  socialImpactScore: number;

  @Column({ name: 'environmental_impact_score', type: 'int', nullable: true })
  environmentalImpactScore: number;

  @Column({ name: 'bonus_points', default: 0 })
  bonusPoints: number;

  // Grille COPA Nyunganira — A. L'objectif et l'idée de projet
  @Column({ name: 'criterion1_score', type: 'int', nullable: true })
  criterion1Score: number;

  @Column({ name: 'criterion2_score', type: 'int', nullable: true })
  criterion2Score: number;

  @Column({ name: 'criterion3_score', type: 'int', nullable: true })
  criterion3Score: number;

  // B. Stratégie et plan marketing
  @Column({ name: 'criterion4_score', type: 'int', nullable: true })
  criterion4Score: number;

  @Column({ name: 'criterion5_score', type: 'int', nullable: true })
  criterion5Score: number;

  @Column({ name: 'criterion6_score', type: 'int', nullable: true })
  criterion6Score: number;

  @Column({ name: 'criterion7_score', type: 'int', nullable: true })
  criterion7Score: number;

  // C. Moyens techniques
  @Column({ name: 'criterion8_score', type: 'int', nullable: true })
  criterion8Score: number;

  @Column({ name: 'criterion9_score', type: 'int', nullable: true })
  criterion9Score: number;

  @Column({ name: 'criterion10_score', type: 'int', nullable: true })
  criterion10Score: number;

  // D. Impact environnemental et social
  @Column({ name: 'criterion11_score', type: 'int', nullable: true })
  criterion11Score: number;

  @Column({ name: 'criterion12_score', type: 'int', nullable: true })
  criterion12Score: number;

  // Critère 13 grille VF26052026 — dirigée par femme/réfugié/batwa/albinos/handicap (0 ou 5)
  @Column({ name: 'criterion16_score', type: 'int', nullable: true })
  criterion16Score: number;

  // E. Études économiques et financières (affichés 14, 15, 16 dans la grille VF26052026)
  @Column({ name: 'criterion13_score', type: 'int', nullable: true })
  criterion13Score: number;

  @Column({ name: 'criterion14_score', type: 'int', nullable: true })
  criterion14Score: number;

  @Column({ name: 'criterion15_score', type: 'int', nullable: true })
  criterion15Score: number;

  @Column({ name: 'total_score', type: 'numeric', precision: 6, scale: 1, nullable: true })
  totalScore: number;

  @Column({ name: 'global_comment', type: 'text', nullable: true })
  globalComment: string;

  @Column({ name: 'criteria_comments', type: 'jsonb', nullable: true })
  criteriaComments: Record<string, string> | null;

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
