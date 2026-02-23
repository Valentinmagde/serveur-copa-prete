import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ConsentType } from '../../reference/entities/consent-type.entity';

@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => ConsentType)
  @JoinColumn({ name: 'consent_type_id' })
  consentType: ConsentType;

  @Column({ name: 'consent_type_id' })
  consentTypeId: number;

  @Column({ default: false })
  value: boolean;

  @Column({
    name: 'given_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  givenAt: Date;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
