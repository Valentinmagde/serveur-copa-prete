import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('document_types')
export class DocumentType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_required_for_company', default: false })
  isRequiredForCompany: boolean;

  @Column({ name: 'is_required_for_business_plan', default: false })
  isRequiredForBusinessPlan: boolean;

  @Column({ name: 'is_required_for_beneficiary', default: false })
  isRequiredForBeneficiary: boolean;

  @Column({ name: 'allowed_formats', type: 'jsonb', nullable: true })
  allowedFormats: string[];

  @Column({ name: 'max_size_mb', default: 10 })
  maxSizeMb: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
