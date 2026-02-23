import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DocumentType } from './document-type.entity';
import { User } from '../../users/entities/user.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  uuid: string;

  @Column({ name: 'document_type_id' })
  documentTypeId: number;

  @ManyToOne(() => DocumentType)
  @JoinColumn({ name: 'document_type_id' })
  documentType: DocumentType;

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'stored_filename' })
  storedFilename: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size_bytes', nullable: true })
  fileSizeBytes: number;

  @Column({ name: 'mime_type', nullable: true })
  mimeType: string;

  @Column({ name: 'hash_sha256', nullable: true })
  hashSha256: string;

  @Column({
    name: 'uploaded_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  uploadedAt: Date;

  @Column({ name: 'uploaded_by_user_id', nullable: true })
  uploadedByUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: User;

  @Column({ name: 'uploaded_ip', nullable: true })
  uploadedIp: string;

  @Column({ name: 'validation_status', default: 'PENDING' })
  validationStatus: string;

  @Column({ name: 'validated_at', nullable: true })
  validatedAt: Date;

  @Column({ name: 'validated_by_user_id', nullable: true })
  validatedByUserId: number;

  @Column({ name: 'rejection_comment', type: 'text', nullable: true })
  rejectionComment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sync_status', default: 'SYNCED' })
  syncStatus: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;
}
