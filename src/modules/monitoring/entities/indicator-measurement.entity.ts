import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MonitoringIndicator } from './monitoring-indicator.entity';
import { CopaEdition } from '../../reference/entities/copa-edition.entity';

@Entity('indicator_measurements')
export class IndicatorMeasurement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MonitoringIndicator)
  @JoinColumn({ name: 'indicator_id' })
  indicator: MonitoringIndicator;

  @Column({ name: 'indicator_id' })
  indicatorId: number;

  @Column({ name: 'measurement_date', type: 'date' })
  measurementDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  value: number;

  @Column({ name: 'disaggregation_dimension', nullable: true })
  disaggregationDimension: string;

  @Column({ name: 'disaggregation_value', nullable: true })
  disaggregationValue: string;

  @ManyToOne(() => CopaEdition)
  @JoinColumn({ name: 'copa_edition_id' })
  copaEdition: CopaEdition;

  @Column({ name: 'copa_edition_id', nullable: true })
  copaEditionId: number;

  @Column({
    name: 'calculation_date',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  calculationDate: Date;

  @Column({ name: 'data_source', type: 'text', nullable: true })
  dataSource: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
