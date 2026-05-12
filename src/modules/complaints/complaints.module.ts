import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { Complaint } from './entities/complaint.entity';
import { ComplaintType } from './entities/complaint-type.entity';
import { Status } from '../reference/entities/status.entity';
import { Document } from '../documents/entities/document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { S3Service } from '../documents/storage/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([Complaint, ComplaintType, Status, Document, DocumentType])],
  controllers: [ComplaintsController],
  providers: [ComplaintsService, S3Service],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
