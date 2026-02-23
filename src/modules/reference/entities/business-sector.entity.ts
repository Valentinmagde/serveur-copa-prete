import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('business_sectors')
export class BusinessSector {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name_fr' })
  nameFr: string;

  @Column({ name: 'name_rn' })
  nameRn: string;

  @Column({ nullable: true, name: 'description_fr' })
  descriptionFr: string;

  @Column({ nullable: true, name: 'description_rn' })
  descriptionRn: string;

  @Column({ name: 'is_copa_eligible', default: true })
  isCopaEligible: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
