import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from './user-role.entity';
import { UserConsent } from './user-consent.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';
import { Address } from '../../reference/entities/address.entity';
import { Gender } from '../../reference/entities/gender.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  uuid: string;

  @Column({ unique: true, name: 'email' })
  email: string;

  @Column({ name: 'password_hash' })
  @Exclude()
  passwordHash: string;

  @Column({ nullable: true, name: 'first_name' })
  firstName: string;

  @Column({ nullable: true, name: 'last_name' })
  lastName: string;

  @Column({ type: 'date', nullable: true, name: 'birth_date' })
  birthDate: Date;

  @ManyToOne(() => Gender)
  @JoinColumn({ name: 'gender_id' })
  gender: Gender;

  @Column({ name: 'gender_id', nullable: true })
  genderId: number | null;

  @Column({ nullable: true, name: 'phone_number' })
  phoneNumber: string;

  @Column({ nullable: true, name: 'nationality' })
  nationality: string;

  @Column({ nullable: true, name: 'profile_photo_url' })
  profilePhotoUrl: string;

  @Column({ nullable: true, name: 'id_document_type' })
  idDocumentType: string;

  @Column({ nullable: true, name: 'id_document_number' })
  idDocumentNumber: string;

  @Column({ default: false, name: 'is_refugee' })
  isRefugee: boolean;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_verified' })
  isVerified: boolean;

  @Column({ default: false, name: 'is_blocked' })
  isBlocked: boolean;

  @Column({ default: 0, name: 'failed_login_attempts' })
  failedLoginAttempts: number;

  @Column({ nullable: true, name: 'last_blocked_at' })
  lastBlockedAt: Date;

  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;

  @Column({ nullable: true, name: 'reset_token' })
  resetToken: string;

  @Column({ nullable: true, name: 'reset_token_expires_at' })
  resetTokenExpiresAt: Date;

  @Column({ type: 'varchar', nullable: true, name: 'verification_token' })
  verificationToken: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'verification_token_expires_at',
  })
  verificationTokenExpiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'cgu_accepted_at' })
  cguAcceptedAt: Date | null;

  @OneToMany(() => UserRole, (userRole: UserRole) => userRole.user)
  userRoles: UserRole[];

  @OneToMany(() => UserConsent, (consent: UserConsent) => consent.user)
  consents: UserConsent[];

  @OneToOne(() => Beneficiary, (beneficiary: Beneficiary) => beneficiary.user)
  beneficiary: Beneficiary;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'primary_address_id' })
  primaryAddress: Address;

  @Column({ name: 'primary_address_id', nullable: true })
  primaryAddressId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'created_by_user_id' })
  createdByIp: string;

  @Column({ default: 'SYNCED', name: 'sync_status' })
  syncStatus: string;

  @Column({ nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date;

  // Virtual fields
  roles?: string[];
}
