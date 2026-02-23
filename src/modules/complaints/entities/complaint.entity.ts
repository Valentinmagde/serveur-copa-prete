import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ComplaintType } from './complaint-type.entity';
import { Status } from '../../reference/entities/status.entity';
import { User } from '../../users/entities/user.entity';

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference_number', unique: true })
  referenceNumber: string;

  @ManyToOne(() => ComplaintType)
  @JoinColumn({ name: 'complaint_type_id' })
  complaintType: ComplaintType;

  @Column({ name: 'complaint_type_id', nullable: true })
  complaintTypeId: number;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ name: 'contact_info', nullable: true })
  contactInfo: string;

  @Column({ name: 'incident_date', type: 'date', nullable: true })
  incidentDate: Date;

  @Column({ name: 'incident_location', type: 'text', nullable: true })
  incidentLocation: string;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => Status)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @Column({ name: 'status_id', nullable: true })
  statusId: number;

  @Column({ name: 'is_confidential', default: false })
  isConfidential: boolean;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  submittedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ name: 'submission_ip', nullable: true })
  submissionIp: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignedTo: User;

  @Column({ name: 'assigned_to_user_id', nullable: true })
  assignedToUserId: number;

  @Column({ name: 'processed_at', nullable: true })
  processedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'processed_by_user_id' })
  processedBy: User;

  @Column({ name: 'processed_by_user_id', nullable: true })
  processedByUserId: number;

  @Column({ name: 'response_provided', type: 'text', nullable: true })
  responseProvided: string;

  @Column({ name: 'generated_vbg_alert', default: false })
  generatedVbgAlert: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
