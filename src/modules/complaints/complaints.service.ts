import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import * as crypto from 'crypto';
import { Complaint } from './entities/complaint.entity';
import { ComplaintType } from './entities/complaint-type.entity';
import { Status } from '../reference/entities/status.entity';
import { Document } from '../documents/entities/document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { S3Service } from '../documents/storage/s3.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

const COMPLAINT_TYPE_MAP: Record<CreateComplaintDto['type'], string> = {
  tech: 'Technical Issue',
  selection: 'Process Irregularity',
  behavior: 'Staff Misconduct',
  corruption: 'Corruption',
  vbg: 'GBV/EAS-HS',
  other: 'Other',
};

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    public readonly complaintRepository: Repository<Complaint>,
    @InjectRepository(ComplaintType)
    public readonly complaintTypeRepository: Repository<ComplaintType>,
    @InjectRepository(Status)
    public readonly statusRepository: Repository<Status>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    createComplaintDto: CreateComplaintDto,
    files: Express.Multer.File[] = [],
    ip?: string,
  ): Promise<Complaint> {
    const complaintTypeName = COMPLAINT_TYPE_MAP[createComplaintDto.type];
    const complaintType = await this.complaintTypeRepository.findOne({
      where: { name: complaintTypeName },
    });

    if (!complaintType) {
      throw new BadRequestException('Invalid complaint type');
    }

    const status = await this.statusRepository.findOne({
      where: { code: 'RECEIVED', entityType: 'COMPLAINT' },
    });

    const data: DeepPartial<Complaint> = {
      referenceNumber: this.generateReference(),
      complaintType,
      complaintTypeId: complaintType.id,
      isAnonymous: createComplaintDto.anonymous,
      fullName: createComplaintDto.name || undefined,
      contactInfo: createComplaintDto.contact || undefined,
      incidentDate: createComplaintDto.date
        ? new Date(createComplaintDto.date)
        : undefined,
      incidentLocation: createComplaintDto.location || undefined,
      description: createComplaintDto.description,
      status: status ?? undefined,
      statusId: status?.id ?? undefined,
      isConfidential:
        createComplaintDto.anonymous || complaintType.requiresConfidentiality,
      submissionIp: ip ?? undefined,
    };

    const complaint = this.complaintRepository.create(data);
    const saved = await this.complaintRepository.save(complaint);

    if (files.length > 0) {
      await this.saveAttachments(saved.id, files, ip);
    }

    return saved;
  }

  private async saveAttachments(
    complaintId: number,
    files: Express.Multer.File[],
    ip?: string,
  ): Promise<void> {
    // Find or create a "Complaint Attachment" document type
    let docType = await this.documentTypeRepository.findOne({
      where: { name: 'Complaint Attachment' },
    });

    if (!docType) {
      const created = this.documentTypeRepository.create({
        name: 'Complaint Attachment',
        description: "Pièce jointe d'une plainte",
        maxSizeMb: 10,
        isActive: true,
      });
      docType = await this.documentTypeRepository.save(created);
    }

    for (const file of files) {
      const ext = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
      const storedFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const s3Key = `complaints/${complaintId}/${storedFilename}`;
      const hash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

      const filePath = await this.s3Service.uploadFile(
        file.buffer,
        s3Key,
        file.mimetype,
      );

      const doc = this.documentRepository.create({
        documentTypeId: docType.id,
        entityId: complaintId,
        entityType: 'complaint',
        documentKey: 'complaint_attachment',
        originalFilename: file.originalname,
        storedFilename,
        filePath,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
        hashSha256: hash,
        uploadedIp: ip ?? undefined,
        validationStatus: 'PENDING',
      });

      await this.documentRepository.save(doc);
    }
  }

  async findById(id: number): Promise<Complaint> {
    const complaint = await this.complaintRepository.findOne({
      where: { id },
      relations: ['complaintType', 'status', 'user', 'assignedTo'],
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    return complaint;
  }

  async findAll(editionId?: number): Promise<Complaint[]> {
    return this.complaintRepository.find({
      where: editionId ? { copaEditionId: editionId } : {},
      relations: ['complaintType', 'status'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: number,
    statusCode: string,
    response?: string,
  ): Promise<Complaint> {
    const complaint = await this.findById(id);

    const status = await this.statusRepository.findOne({
      where: { code: statusCode, entityType: 'COMPLAINT' },
    });

    if (!status) {
      throw new BadRequestException(`Statut "${statusCode}" invalide`);
    }

    complaint.status = status;
    complaint.statusId = status.id;

    if (response) {
      complaint.responseProvided = response;
      complaint.processedAt = new Date();
    }

    await this.complaintRepository.save(complaint);
    return this.findById(id);
  }

  private generateReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `COPA-${timestamp}-${randomPart}`;
  }
}
