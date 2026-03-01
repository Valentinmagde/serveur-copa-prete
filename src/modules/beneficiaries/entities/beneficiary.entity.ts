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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ nullable: true, default: null, name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: 'SYNCED', name: 'sync_status' })
  syncStatus: string;

  @Column({ nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date;
}
