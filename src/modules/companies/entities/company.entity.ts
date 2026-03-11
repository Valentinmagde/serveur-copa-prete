import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Address } from '../../reference/entities/address.entity';
import { LegalForm } from '../../reference/entities/legal-form.entity';
import { BusinessSector } from '../../reference/entities/business-sector.entity';
import { Status } from '../../reference/entities/status.entity';
import { User } from '../../users/entities/user.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  uuid: string;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'headquarters_address_id' })
  headquartersAddress: Address;

  @Column({ name: 'headquarters_address_id', nullable: true })
  headquartersAddressId: number | null;

  @Column({ name: 'registration_number', unique: true, nullable: true })
  registrationNumber: string;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ nullable: true })
  acronym: string;

  @ManyToOne(() => LegalForm)
  @JoinColumn({ name: 'legal_form_id' })
  legalForm: LegalForm;

  @Column({ name: 'legal_form_id', nullable: true })
  legalFormId: number;

  @Column({ name: 'rc_number', unique: true, nullable: true })
  rcNumber: string;

  @Column({ name: 'tax_id_number', unique: true, nullable: true })
  taxIdNumber: string;

  @Column({ name: 'taxpayer_number', nullable: true })
  taxpayerNumber: string;

  @Column({ name: 'creation_date', type: 'date', nullable: true })
  creationDate: Date | null;

  @ManyToOne(() => BusinessSector)
  @JoinColumn({ name: 'primary_sector_id' })
  primarySector: BusinessSector;

  @Column({ name: 'primary_sector_id', nullable: true })
  primarySectorId: number;

  @ManyToOne(() => BusinessSector)
  @JoinColumn({ name: 'secondary_sector_id' })
  secondarySector: BusinessSector;

  @Column({ name: 'secondary_sector_id', nullable: true })
  secondarySectorId: number;

  @Column({ name: 'activity_description', type: 'text', nullable: true })
  activityDescription: string;

  @Column({
    name: 'company_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  companyType: string | null;

  @Column({ name: 'website_url', nullable: true })
  websiteUrl: string;

  @Column({ name: 'facebook_page', nullable: true })
  facebookPage: string;

  @Column({ name: 'permanent_employees', default: 0 })
  permanentEmployees: number;

  @Column({ name: 'temporary_employees', default: 0 })
  temporaryEmployees: number;

  @Column({ name: 'female_employees', default: 0 })
  femaleEmployees: number;

  @Column({ name: 'male_employees', default: 0 })
  maleEmployees: number;

  @Column({ name: 'young_employees', default: 0 })
  youngEmployees: number;

  @Column({
    name: 'revenue_year_n1',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  revenueYearN1: number;

  @Column({
    name: 'revenue_year_n2',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  revenueYearN2: number;

  @Column({ name: 'is_led_by_woman', default: false })
  isLedByWoman: boolean;

  @Column({ name: 'is_led_by_young', default: false })
  isLedByYoung: boolean;

  @Column({ name: 'is_led_by_refugee', default: false })
  isLedByRefugee: boolean;

  @Column({ name: 'has_positive_climate_impact', default: false })
  hasPositiveClimateImpact: boolean;

  @ManyToOne(() => Status)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @Column({ name: 'status_id', nullable: true })
  statusId: number | null;

  @Column({ name: 'validated_at', nullable: true })
  validatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'validated_by_user_id' })
  validatedBy: User;

  @Column({ name: 'validated_by_user_id', nullable: true })
  validatedByUserId: number;

  @OneToMany(() => Beneficiary, (beneficiary) => beneficiary.company)
  beneficiaries: Beneficiary[];

  @Column({ name: 'legal_status', nullable: true })
  legalStatus?: string;

  @Column({ name: 'legal_status_other', nullable: true })
  legalStatusOther?: string;

  @Column({ name: 'affiliated_to_cga', nullable: true })
  affiliatedToCGA?: boolean;

  @Column({ name: 'refugee_employees', default: 0 })
  refugeeEmployees: number;

  @Column({ name: 'batwa_employees', default: 0 })
  batwaEmployees: number;

  @Column({ name: 'disabled_employees', default: 0 })
  disabledEmployees: number;

  @Column({ name: 'associates_count', nullable: true })
  associatesCount?: string;

  @Column({ name: 'associates_count_other', nullable: true })
  associatesCountOther?: string;

  @Column({ name: 'female_partners', default: 0 })
  femalePartners: number;

  @Column({ name: 'male_partners', default: 0 })
  malePartners: number;

  @Column({ name: 'refugee_partners', default: 0 })
  refugeePartners: number;

  @Column({ name: 'batwa_partners', default: 0 })
  batwaPartners: number;

  @Column({ name: 'disabled_partners', default: 0 })
  disabledPartners: number;

  @Column({ name: 'has_bank_account', nullable: true })
  hasBankAccount?: boolean;

  @Column({ name: 'has_bank_credit', nullable: true })
  hasBankCredit?: boolean;

  @Column({
    name: 'bank_credit_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  bankCreditAmount?: number;

  @Column({ name: 'company_phone', nullable: true })
  companyPhone?: string;

  @Column({ name: 'company_email', nullable: true })
  companyEmail?: string;

  @Column({ name: 'address_id', nullable: true })
  addressId: number;

  @OneToOne(() => Address)
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
