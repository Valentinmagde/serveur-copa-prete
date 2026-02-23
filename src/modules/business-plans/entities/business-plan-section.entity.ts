import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessPlan } from './business-plan.entity';
import { BusinessPlanSectionType } from '../../reference/entities/business-plan-section-type.entity';
import { User } from '../../users/entities/user.entity';

@Entity('business_plan_sections')
export class BusinessPlanSection {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BusinessPlan)
  @JoinColumn({ name: 'business_plan_id' })
  businessPlan: BusinessPlan;

  @Column({ name: 'business_plan_id' })
  businessPlanId: number;

  @ManyToOne(() => BusinessPlanSectionType)
  @JoinColumn({ name: 'section_type_id' })
  sectionType: BusinessPlanSectionType;

  @Column({ name: 'section_type_id' })
  sectionTypeId: number;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText: string;

  @Column({ name: 'structured_data', type: 'jsonb', nullable: true })
  structuredData: any;

  @Column({ name: 'section_order' })
  sectionOrder: number;

  @Column({ default: 1 })
  version: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'modified_by_user_id' })
  modifiedBy: User;

  @Column({ name: 'modified_by_user_id', nullable: true })
  modifiedByUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
