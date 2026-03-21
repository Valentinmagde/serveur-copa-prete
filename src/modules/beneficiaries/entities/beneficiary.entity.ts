import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Company } from '../../companies/entities/company.entity';
import { Status } from '../../reference/entities/status.entity';
import { BusinessPlan } from '../../business-plans/entities/business-plan.entity';
import { TrainingParticipation } from '../../training/entities/training-participation.entity';
import { Mentorship } from '../../mentoring/entities/mentorship.entity';
import { Subvention } from '../../subventions/entities/subvention.entity';

@Entity('beneficiaries')
export class Beneficiary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  uuid: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => Company, (company) => company.beneficiaries)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'company_id', nullable: true })
  companyId: number | null;

  @Column({
    name: 'company_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  companyType: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'validated_by_user_id' })
  validatedBy: User;

  @Column({ name: 'validated_by_user_id', nullable: true })
  validatedByUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'pre_selected_by_user_id' })
  preSelectedBy: User;

  @Column({ name: 'pre_selected_by_user_id', nullable: true })
  preSelectedByUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'rejected_by_user_id' })
  rejectedBy: User;

  @Column({ name: 'rejected_by_user_id', nullable: true })
  rejectedByUserId: number;

  @ManyToOne(() => Status)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @Column({ name: 'status_id', nullable: true })
  statusId: number;

  @Column({ nullable: true, enum: ['BURUNDIAN', 'REFUGEE', 'OTHER'] })
  category: string;

  @ManyToOne(() => Status)
  @JoinColumn({ name: 'subscription_status_id' })
  subscriptionStatus: Status;

  @Column({ name: 'subscription_status_id', nullable: true })
  subscriptionStatusId: number;

  @Column({ nullable: true, name: 'validated_at' })
  validatedAt: Date;

  @Column({ nullable: true, name: 'pre_selected_at' })
  preSelectedAt: Date;

  @Column({ nullable: true, name: 'rejected_at' })
  rejectedAt: Date;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string;

  @OneToMany(
    () => BusinessPlan,
    (businessPlan: BusinessPlan) => businessPlan.beneficiary,
  )
  businessPlans: BusinessPlan[];

  @OneToMany(
    () => TrainingParticipation,
    (participation: TrainingParticipation) => participation.beneficiary,
  )
  trainingParticipations: TrainingParticipation[];

  @OneToMany(
    () => Mentorship,
    (mentorship: Mentorship) => mentorship.beneficiary,
  )
  mentorships: Mentorship[];

  @OneToMany(
    () => Subvention,
    (subvention: Subvention) => subvention.beneficiary,
  )
  subventions: Subvention[];

  @Column({
    name: 'profile_completion_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  profileCompletionPercentage: number;

  @Column({
    name: 'profile_completion_step',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  profileCompletionStep: string;

  @Column({
    name: 'profile_completed_at',
    type: 'timestamp',
    nullable: true,
  })
  profileCompletedAt: Date;

  @Column({
    name: 'is_profile_complete',
    type: 'boolean',
    default: false,
  })
  isProfileComplete: boolean;

  @Column({ nullable: true })
  position?: string;

  @Column({ name: 'marital_status', nullable: true })
  maritalStatus?: string;

  @Column({ name: 'education_level', nullable: true })
  educationLevel?: string;

  @Column({ name: 'is_public_servant', nullable: true })
  isPublicServant?: boolean;

  @Column({ name: 'is_relative_of_public_servant', nullable: true })
  isRelativeOfPublicServant?: boolean;

  @Column({ name: 'is_public_intern', nullable: true })
  isPublicIntern?: boolean;

  @Column({ name: 'is_relative_of_public_intern', nullable: true })
  isRelativeOfPublicIntern?: boolean;

  @Column({ name: 'was_high_officer', nullable: true })
  wasHighOfficer?: boolean;

  @Column({ name: 'is_relative_of_high_officer', nullable: true })
  isRelativeOfHighOfficer?: boolean;

  @Column({ name: 'has_project_link', nullable: true })
  hasProjectLink?: boolean;

  @Column({ name: 'is_direct_supplier_to_project', nullable: true })
  isDirectSupplierToProject?: boolean;

  @Column({ name: 'has_previous_grant', nullable: true })
  hasPreviousGrant?: boolean;

  @Column({ name: 'previous_grant_details', type: 'text', nullable: true })
  previousGrantDetails?: string;

  @Column({ name: 'project_title', nullable: true })
  projectTitle?: string;

  @Column({ name: 'project_objective', type: 'text', nullable: true })
  projectObjective?: string;

  @Column({ name: 'project_sectors', type: 'jsonb', nullable: true })
  projectSectors?: string[];

  @Column({ name: 'other_sector', nullable: true })
  otherSector?: string;

  @Column({ name: 'main_activities', type: 'text', nullable: true })
  mainActivities?: string;

  @Column({ name: 'products_services', type: 'text', nullable: true })
  productsServices?: string;

  @Column({ name: 'business_idea', type: 'text', nullable: true })
  businessIdea?: string;

  @Column({ name: 'target_clients', type: 'text', nullable: true })
  targetClients?: string;

  @Column({ name: 'client_scope', type: 'jsonb', nullable: true })
  clientScope?: string[];

  @Column({ name: 'has_competitors', nullable: true })
  hasCompetitors?: boolean;

  @Column({ name: 'competitor_names', type: 'text', nullable: true })
  competitorNames?: string;

  @Column({ name: 'planned_employees_female', nullable: true })
  plannedEmployeesFemale: number;

  @Column({ name: 'planned_employees_male', nullable: true })
  plannedEmployeesMale: number;

  @Column({ name: 'planned_permanent_employees', nullable: true })
  plannedPermanentEmployees: number;

  @Column({ name: 'is_new_idea', nullable: true })
  isNewIdea?: boolean;

  @Column({ name: 'climate_actions', type: 'text', nullable: true })
  climateActions?: string;

  @Column({ name: 'inclusion_actions', type: 'text', nullable: true })
  inclusionActions?: string;

  @Column({ name: 'has_estimated_cost', nullable: true })
  hasEstimatedCost?: boolean;

  @Column({ name: 'planned_refugee_employees', default: 0 })
  plannedRefugeeEmployees: number;

  @Column({ name: 'planned_batwa_employees', default: 0 })
  plannedBatwaEmployees: number;

  @Column({ name: 'planned_disabled_employees', default: 0 })
  plannedDisabledEmployees: number;

  @Column({ name: 'planned_albinos_employees', default: 0 })
  plannedAlbinosEmployees: number;

  @Column({ name: 'planned_repatriates_employees', default: 0 })
  plannedRepatriatesEmployees: number;

  @Column({ name: 'planned_part_time_employees', default: 0 })
  plannedPartTimeEmployees: number;

  // ===== AUTRES CHAMPS =====
  @Column({ name: 'idea_tested', nullable: true })
  ideaTested?: boolean;

  @Column({
    name: 'total_project_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalProjectCost?: number;

  @Column({
    name: 'requested_subsidy_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  requestedSubsidyAmount?: number;

  @Column({ name: 'main_expenses', type: 'text', nullable: true })
  mainExpenses?: string;

  @Column({ name: 'application_code', unique: true, nullable: true })
  applicationCode: string;

  @Column({
    name: 'application_submitted_at',
    type: 'timestamp',
    nullable: true,
  })
  applicationSubmittedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ nullable: true, default: null, name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: 'SYNCED', name: 'sync_status' })
  syncStatus: string;

  @Column({ nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date;
}
