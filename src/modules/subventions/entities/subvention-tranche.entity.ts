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
import { User } from '../../users/entities/user.entity';

@Entity('subvention_tranches')
export class SubventionTranche {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Subvention)
  @JoinColumn({ name: 'subvention_id' })
  subvention: Subvention;

  @Column({ name: 'subvention_id' })
  subventionId: number;

  @Column({ name: 'tranche_number' })
  trancheNumber: number;

  @Column({ type: 'decimal', precision: 15, scale: 0 })
  amount: number;

  @Column({ nullable: true })
  percentage: number;

  @Column({ name: 'release_condition', type: 'text', nullable: true })
  releaseCondition: string;

  @Column({ name: 'planned_date', type: 'date', nullable: true })
  plannedDate: Date;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ name: 'effective_release_date', type: 'date', nullable: true })
  effectiveReleaseDate: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'released_by_user_id' })
  releasedBy: User;

  @Column({ name: 'released_by_user_id', nullable: true })
  releasedByUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
