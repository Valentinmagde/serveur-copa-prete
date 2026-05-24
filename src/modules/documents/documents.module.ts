import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { DocumentType } from './entities/document-type.entity';
import { S3Service } from './storage/s3.service';
import { BeneficiariesModule } from '../beneficiaries/beneficiaries.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentType]), BeneficiariesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, S3Service],
  exports: [DocumentsService],
})
export class DocumentsModule {}
