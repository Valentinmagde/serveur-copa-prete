import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ description: 'ID du bénéficiaire' })
  @Type(() => Number)
  @IsInt()
  entityId: number;

  @ApiProperty({ description: "Type d'entité", default: 'beneficiary' })
  @IsOptional()
  @IsIn(['beneficiary', 'company', 'businessPlan'])
  entityType?: string = 'beneficiary';

  @ApiProperty({
    description: 'Clé du document',
    enum: [
      'idCard',
      'criminalRecord',
      'managerAct',
      'commerceRegister',
      'bankStatements',
      'communalAttestation',
    ],
  })
  @IsIn([
    'idCard',
    'criminalRecord',
    'managerAct',
    'commerceRegister',
    'bankStatements',
    'communalAttestation',
  ])
  documentKey: string;

  @ApiProperty({ description: 'Type de document (ID du document type)' })
  @Type(() => Number)
  @IsInt()
  documentTypeId: number;

  @ApiProperty({
    description: 'Étape du formulaire',
    enum: ['STEP1', 'STEP2', 'STEP3', 'STEP4', 'CORRECTION'],
    required: false,
  })
  @IsOptional()
  @IsIn(['STEP1', 'STEP2', 'STEP3', 'STEP4', 'CORRECTION'])
  formStep?: string;
}
