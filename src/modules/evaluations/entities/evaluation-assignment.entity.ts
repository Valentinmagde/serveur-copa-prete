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
import { CopaEdition } from '../../reference/entities/copa-edition.entity';
import { User } from '../../users/entities/user.entity';

@Entity('evaluation_assignments')
export class EvaluationAssignment {
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

  @ManyToOne(() => CopaEdition)
  @JoinColumn({ name: 'copa_edition_id' })
  copaEdition: CopaEdition;

  @Column({ name: 'copa_edition_id' })
  copaEditionId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_by_user_id' })
  assignedBy: User;

  @Column({ name: 'assigned_by_user_id', nullable: true })
  assignedByUserId: number;

  @Column({
    name: 'assigned_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  assignedAt: Date;

  @Column({ type: 'date', nullable: true })
  deadline: Date;

  @Column({ default: 'PENDING' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
