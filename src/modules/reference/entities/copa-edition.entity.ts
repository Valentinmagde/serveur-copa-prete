import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('copa_editions')
export class CopaEdition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column()
  year: number;

  @Column({ name: 'registration_start_date', type: 'date' })
  registrationStartDate: Date;

  @Column({ name: 'registration_end_date', type: 'date' })
  registrationEndDate: Date;

  @Column({ name: 'submission_start_date', type: 'date' })
  submissionStartDate: Date;

  @Column({ name: 'submission_end_date', type: 'date' })
  submissionEndDate: Date;

  @Column({ name: 'evaluation_start_date', type: 'date', nullable: true })
  evaluationStartDate: Date;

  @Column({ name: 'evaluation_end_date', type: 'date', nullable: true })
  evaluationEndDate: Date;

  @Column({ name: 'selection_committee_date', type: 'date', nullable: true })
  selectionCommitteeDate: Date;

  @Column({ name: 'results_publication_date', type: 'date', nullable: true })
  resultsPublicationDate: Date;

  @Column({
    name: 'total_budget',
    type: 'decimal',
    precision: 15,
    scale: 0,
    nullable: true,
  })
  totalBudget: number;

  @Column({ name: 'expected_winners_count', nullable: true })
  expectedWinnersCount: number;

  @Column({ name: 'regulations_url', nullable: true })
  regulationsUrl: string;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
