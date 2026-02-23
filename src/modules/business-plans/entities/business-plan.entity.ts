import { Beneficiary } from '@/modules/beneficiaries/entities/beneficiary.entity';
import { BusinessSector } from '@/modules/reference/entities/business-sector.entity';
import { CopaEdition } from '@/modules/reference/entities/copa-edition.entity';
import { Status } from '@/modules/reference/entities/status.entity';
import { User } from '@/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessPlanSection } from './business-plan-section.entity';
import { Evaluation } from '@/modules/evaluations/entities/evaluation.entity';
import { Subvention } from '@/modules/subventions/entities/subvention.entity';

@Entity('business_plans')
export class BusinessPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, name: 'reference_number' })
  referenceNumber: string;

  @ManyToOne(() => CopaEdition)
  @JoinColumn({ name: 'copa_edition_id' })
  copaEdition: CopaEdition;

  @Column({ name: 'copa_edition_id' })
  copaEditionId: number;

  @ManyToOne(
    () => Beneficiary,
    (beneficiary: Beneficiary) => beneficiary.businessPlans,
  )
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary: Beneficiary;

  @Column({ name: 'beneficiary_id' })
  beneficiaryId: number;

  @Column({ name: 'project_title' })
  projectTitle: string;

  @Column({ type: 'text', nullable: true, name: 'project_description' })
  projectDescription: string;

  @ManyToOne(() => BusinessSector)
  @JoinColumn({ name: 'business_sector_id' })
  businessSector: BusinessSector;

  @Column({ name: 'business_sector_id', nullable: true })
  businessSectorId: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
    name: 'requested_funding_amount',
  })
  requestedFundingAmount: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
    name: 'personal_contribution_amount',
  })
  personalContributionAmount: number;

  @Column({ nullable: true, name: 'expected_jobs_count' })
  expectedJobsCount: number;

  @Column({ nullable: true, name: 'expected_women_jobs_count' })
  expectedWomenJobsCount: number;

  @Column({ default: 1, name: 'version_number' })
  versionNumber: number;

  @Column({ default: false, name: 'is_final_version' })
  isFinalVersion: boolean;

  @ManyToOne(() => BusinessPlan)
  @JoinColumn({ name: 'parent_business_plan_id' })
  parentBusinessPlan: BusinessPlan;

  @Column({ name: 'parent_business_plan_id', nullable: true })
  parentBusinessPlanId: number;

  @ManyToOne(() => Status)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @Column({ name: 'status_id', nullable: true })
  statusId: number;

  @Column({ nullable: true, name: 'submitted_at' })
  submittedAt: Date;

  @Column({ nullable: true, name: 'last_modified_at' })
  lastModifiedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by_user_id' })
  submittedBy: User;

  @Column({ name: 'submitted_by_user_id', nullable: true })
  submittedByUserId: number;

  @OneToMany(
    () => BusinessPlanSection,
    (section: BusinessPlanSection) => section.businessPlan,
  )
  sections: BusinessPlanSection[];

  @OneToMany(
    () => Evaluation,
    (evaluation: Evaluation) => evaluation.businessPlan,
  )
  evaluations: Evaluation[];

  @OneToOne(
    () => Subvention,
    (subvention: Subvention) => subvention.businessPlan,
  )
  subvention: Subvention;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: 'SYNCED', name: 'sync_status' })
  syncStatus: string;

  @Column({ nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date;

  // Virtual fields
  averageScore?: number;
  evaluationCount?: number;
}
