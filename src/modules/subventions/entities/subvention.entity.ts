import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { BusinessPlan } from '../../business-plans/entities/business-plan.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';
import { Status } from '../../reference/entities/status.entity';
import { User } from '../../users/entities/user.entity';
import { SubventionTranche } from './subvention-tranche.entity';
import { CreatedJob } from './created-job.entity';

@Entity('subventions')
export class Subvention {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'agreement_number', unique: true })
  agreementNumber: string;

  @OneToOne(() => BusinessPlan)
  @JoinColumn({ name: 'business_plan_id' })
  businessPlan: BusinessPlan;

  @Column({ name: 'business_plan_id', unique: true })
  businessPlanId: number;

  @ManyToOne(() => Beneficiary)
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary: Beneficiary;

  @Column({ name: 'beneficiary_id' })
  beneficiaryId: number;

  @Column({ name: 'awarded_amount', type: 'decimal', precision: 15, scale: 0 })
  awardedAmount: number;

  @Column({
    name: 'counterpart_amount',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  counterpartAmount: number;

  @Column({ name: 'signature_date', type: 'date' })
  signatureDate: Date;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'planned_end_date', type: 'date', nullable: true })
  plannedEndDate: Date;

  @ManyToOne(() => Status)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @Column({ name: 'status_id', nullable: true })
  statusId: number;

  @Column({ name: 'agreement_file_url', nullable: true })
  agreementFileUrl: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedBy: User;

  @Column({ name: 'approved_by_user_id', nullable: true })
  approvedByUserId: number;

  @Column({ name: 'approval_date', nullable: true })
  approvalDate: Date;

  @OneToMany(() => SubventionTranche, (tranche) => tranche.subvention)
  tranches: SubventionTranche[];

  @OneToMany(() => CreatedJob, (job) => job.subvention)
  createdJobs: CreatedJob[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
