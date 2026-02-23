import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('monitoring_indicators')
export class MonitoringIndicator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'measurement_frequency', nullable: true })
  measurementFrequency: string;

  @Column({ name: 'requires_gender_disaggregation', default: false })
  requiresGenderDisaggregation: boolean;

  @Column({ name: 'requires_province_disaggregation', default: false })
  requiresProvinceDisaggregation: boolean;

  @Column({ name: 'requires_refugee_disaggregation', default: false })
  requiresRefugeeDisaggregation: boolean;

  @Column({ name: 'requires_sector_disaggregation', default: false })
  requiresSectorDisaggregation: boolean;

  @Column({ name: 'requires_climate_disaggregation', default: false })
  requiresClimateDisaggregation: boolean;

  @Column({ name: 'calculation_formula', type: 'text', nullable: true })
  calculationFormula: string;

  @Column({ name: 'data_source', type: 'text', nullable: true })
  dataSource: string;

  @Column({
    name: 'baseline_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  baselineValue: number;

  @Column({
    name: 'target_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  targetValue: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
