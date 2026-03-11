import {
  Injectable,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { Document } from './entities/document.entity';
import { DocumentType } from './entities/document-type.entity';
import { UploadDocumentDto, DocumentFilterDto } from './dto';
import { S3Service } from './storage/s3.service';
import {
  PaginationUtil,
  PaginatedResult,
} from '../../common/utils/pagination.util';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly s3Service: S3Service,
  ) {}

  // async upload(
  //   file: Express.Multer.File,
  //   uploadDto: UploadDocumentDto,
  //   userId: number,
  //   ip: string,
  // ): Promise<Document> {
  //   // Validate document type
  //   const documentType = await this.documentTypeRepository.findOne({
  //     where: { id: uploadDto.documentTypeId, isActive: true },
  //   });

  //   if (!documentType) {
  //     throw new BadRequestException('Invalid document type');
  //   }

  //   // Validate file size
  //   const maxSize = (documentType.maxSizeMb || 10) * 1024 * 1024;
  //   if (file.size > maxSize) {
  //     throw new BadRequestException(
  //       `File size exceeds maximum allowed (${documentType.maxSizeMb}MB)`,
  //     );
  //   }

  //   // Validate mime type
  //   const allowedFormats = documentType.allowedFormats || [
  //     'pdf',
  //     'jpg',
  //     'png',
  //     'doc',
  //     'docx',
  //   ];
  //   const fileExtension =
  //     file.originalname.split('.').pop()?.toLowerCase() || '';
  //   if (!allowedFormats.includes(fileExtension)) {
  //     throw new BadRequestException(
  //       `File format not allowed. Allowed: ${allowedFormats.join(', ')}`,
  //     );
  //   }

  //   // Generate hash
  //   const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

  //   // Check for duplicate
  //   const existingDocument = await this.documentRepository.findOne({
  //     where: { hashSha256: hash },
  //   });

  //   if (existingDocument) {
  //     // Return existing document if it's the same file
  //     return existingDocument;
  //   }

  //   // Generate filename
  //   const storedFilename = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;

  //   // Upload to S3 or local storage
  //   const filePath = await this.s3Service.uploadFile(
  //     file.buffer,
  //     storedFilename,
  //     file.mimetype,
  //   );

  //   // Create document record
  //   const documentData = {
  //     documentTypeId: uploadDto.documentTypeId,
  //     originalFilename: file.originalname,
  //     storedFilename,
  //     filePath,
  //     fileSizeBytes: file.size,
  //     mimeType: file.mimetype,
  //     hashSha256: hash,
  //     uploadedByUserId: userId,
  //     uploadedIp: ip,
  //     validationStatus: 'PENDING',
  //   };

  //   const document = this.documentRepository.create(documentData);
  //   const savedDocument = await this.documentRepository.save(document);
  //   return this.findById(savedDocument.id);
  // }

  async upload(
    file: Express.Multer.File,
    uploadDto: UploadDocumentDto,
    userId: number,
    ip: string,
  ): Promise<Document> {
    // Validate document type
    const documentType = await this.documentTypeRepository.findOne({
      where: { id: uploadDto.documentTypeId, isActive: true },
    });

    if (!documentType) {
      throw new BadRequestException('Invalid document type');
    }

    // Validate file size
    const maxSize = (documentType.maxSizeMb || 10) * 1024 * 1024;
    if (file?.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${documentType.maxSizeMb}MB)`,
      );
    }

    // Validate mime type
    const allowedFormats = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const fileExtension =
      file.originalname.split('.').pop()?.toLowerCase() || '';
    if (!allowedFormats.includes(fileExtension)) {
      throw new BadRequestException(
        `File format not allowed. Allowed: ${allowedFormats.join(', ')}`,
      );
    }

    // Generate hash
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Generate filename
    const storedFilename = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;

    // Upload to S3 or local storage
    const filePath = await this.s3Service.uploadFile(
      file.buffer,
      storedFilename,
      file.mimetype,
    );

    // Create document record
    const documentData = {
      documentTypeId: uploadDto.documentTypeId,
      entityId: uploadDto.entityId,
      entityType: uploadDto.entityType || 'beneficiary',
      documentKey: uploadDto.documentKey,
      formStep: uploadDto.formStep || 'STEP4',
      originalFilename: file.originalname,
      storedFilename,
      filePath,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      hashSha256: hash,
      uploadedByUserId: userId,
      uploadedIp: ip,
      validationStatus: 'PENDING',
    };

    const document = this.documentRepository.create(documentData);
    const savedDocument = await this.documentRepository.save(document);
    return this.findById(savedDocument.id);
  }

  async getDocumentsByEntity(
    entityId: number,
    entityType: string = 'beneficiary',
    documentKey?: string,
  ): Promise<Document[]> {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.documentType', 'documentType')
      .leftJoinAndSelect('document.uploadedBy', 'uploadedBy')
      .where('document.entityId = :entityId', { entityId })
      .andWhere('document.entityType = :entityType', { entityType });

    if (documentKey) {
      queryBuilder.andWhere('document.documentKey = :documentKey', {
        documentKey,
      });
    }

    return await queryBuilder.orderBy('document.createdAt', 'DESC').getMany();
  }

  async findAll(
    filterDto: DocumentFilterDto,
  ): Promise<PaginatedResult<Document>> {
    const {
      page = 1,
      limit = 10,
      documentTypeId,
      validationStatus,
      uploadedByUserId,
    } = filterDto;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.documentType', 'documentType')
      .leftJoinAndSelect('document.uploadedBy', 'uploadedBy');

    if (documentTypeId) {
      queryBuilder.andWhere('document.documentTypeId = :documentTypeId', {
        documentTypeId,
      });
    }

    if (validationStatus) {
      queryBuilder.andWhere('document.validationStatus = :validationStatus', {
        validationStatus,
      });
    }

    if (uploadedByUserId) {
      queryBuilder.andWhere('document.uploadedByUserId = :uploadedByUserId', {
        uploadedByUserId,
      });
    }

    const [documents, total] = await queryBuilder
      .orderBy('document.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return PaginationUtil.paginate(documents, total, { page, limit });
  }

  async findById(id: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['documentType', 'uploadedBy'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async download(id: number): Promise<StreamableFile> {
    const document = await this.findById(id);

    const fileStream = await this.s3Service.downloadFile(
      document.storedFilename,
    );

    return new StreamableFile(fileStream, {
      disposition: `attachment; filename="${document.originalFilename}"`,
      type: document.mimeType || 'application/octet-stream',
    });
  }

  async validate(
    id: number,
    userId: number,
    comment?: string,
  ): Promise<Document> {
    const document = await this.findById(id);

    document.validationStatus = 'VALIDATED';
    document.validatedAt = new Date();
    document.validatedByUserId = userId;
    if (comment) {
      document.rejectionComment = comment;
    }

    const updated = await this.documentRepository.save(document);
    return this.findById(updated.id);
  }

  async reject(id: number, userId: number, comment: string): Promise<Document> {
    const document = await this.findById(id);

    document.validationStatus = 'REJECTED';
    document.validatedAt = new Date();
    document.validatedByUserId = userId;
    document.rejectionComment = comment;

    const updated = await this.documentRepository.save(document);
    return this.findById(updated.id);
  }

  async delete(id: number): Promise<void> {
    const document = await this.findById(id);

    // Delete from storage
    try {
      await this.s3Service.deleteFile(document.storedFilename);
    } catch (error) {
      console.error('Error deleting file from storage:', error);
    }

    // Delete from database
    await this.documentRepository.delete(id);
  }

  async getDocumentTypes(requiredFor?: string): Promise<DocumentType[]> {
    const queryBuilder = this.documentTypeRepository
      .createQueryBuilder('type')
      .where('type.isActive = :isActive', { isActive: true });

    if (requiredFor === 'company') {
      queryBuilder.andWhere('type.isRequiredForCompany = :required', {
        required: true,
      });
    } else if (requiredFor === 'beneficiary') {
      queryBuilder.andWhere('type.isRequiredForBeneficiary = :required', {
        required: true,
      });
    } else if (requiredFor === 'businessPlan') {
      queryBuilder.andWhere('type.isRequiredForBusinessPlan = :required', {
        required: true,
      });
    }

    return await queryBuilder.orderBy('type.name', 'ASC').getMany();
  }

  // async getDocumentsByEntity(
  //   entityType: string,
  //   entityId: number,
  // ): Promise<Document[]> {
  //   let documents: Document[] = [];

  //   switch (entityType) {
  //     case 'company':
  //       documents = await this.documentRepository
  //         .createQueryBuilder('document')
  //         .innerJoin('company_documents', 'cd', 'cd.document_id = document.id')
  //         .where('cd.company_id = :entityId', { entityId })
  //         .leftJoinAndSelect('document.documentType', 'documentType')
  //         .getMany();
  //       break;
  //     case 'beneficiary':
  //       documents = await this.documentRepository
  //         .createQueryBuilder('document')
  //         .innerJoin(
  //           'beneficiary_documents',
  //           'bd',
  //           'bd.document_id = document.id',
  //         )
  //         .where('bd.beneficiary_id = :entityId', { entityId })
  //         .leftJoinAndSelect('document.documentType', 'documentType')
  //         .getMany();
  //       break;
  //     case 'businessPlan':
  //       documents = await this.documentRepository
  //         .createQueryBuilder('document')
  //         .innerJoin(
  //           'business_plan_documents',
  //           'bpd',
  //           'bpd.document_id = document.id',
  //         )
  //         .where('bpd.business_plan_id = :entityId', { entityId })
  //         .leftJoinAndSelect('document.documentType', 'documentType')
  //         .getMany();
  //       break;
  //     default:
  //       throw new BadRequestException('Invalid entity type');
  //   }

  //   return documents;
  // }
}
