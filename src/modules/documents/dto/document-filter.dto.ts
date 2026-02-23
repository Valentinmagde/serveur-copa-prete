import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  documentTypeId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  validationStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  uploadedByUserId?: number;
}
