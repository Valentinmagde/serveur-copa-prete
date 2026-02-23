import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('evaluators')
export class Evaluator {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ nullable: true })
  expertise: string;

  @Column({ name: 'is_independent', default: true })
  isIndependent: boolean;

  @Column({ name: 'validated_at', nullable: true })
  validatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'validated_by_user_id' })
  validatedBy: User;

  @Column({ name: 'validated_by_user_id', nullable: true })
  validatedByUserId: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
