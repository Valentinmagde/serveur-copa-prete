import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty()
  @IsInt()
  documentTypeId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
