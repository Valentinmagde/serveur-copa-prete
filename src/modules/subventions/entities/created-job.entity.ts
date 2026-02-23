import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Subvention } from './subvention.entity';
import { Gender } from '../../reference/entities/gender.entity';
import { User } from '../../users/entities/user.entity';

@Entity('created_jobs')
export class CreatedJob {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Subvention)
  @JoinColumn({ name: 'subvention_id' })
  subvention: Subvention;

  @Column({ name: 'subvention_id' })
  subventionId: number;

  @Column({ name: 'employee_name' })
  employeeName: string;

  @ManyToOne(() => Gender)
  @JoinColumn({ name: 'employee_gender_id' })
  employeeGender: Gender;

  @Column({ name: 'employee_gender_id', nullable: true })
  employeeGenderId: number;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;

  @Column({ name: 'is_refugee', default: false })
  isRefugee: boolean;

  @Column({ name: 'hiring_date', type: 'date' })
  hiringDate: Date;

  @Column({ name: 'contract_type', nullable: true })
  contractType: string;

  @Column({
    name: 'monthly_salary',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  monthlySalary: number;

  @Column({ name: 'job_still_maintained', default: true })
  jobStillMaintained: boolean;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'declared_by_user_id' })
  declaredBy: User;

  @Column({ name: 'declared_by_user_id', nullable: true })
  declaredByUserId: number;

  @Column({
    name: 'declaration_date',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  declarationDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
