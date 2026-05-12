import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateComplaintDto {
  @ApiProperty({ example: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  anonymous: boolean;

  @ApiProperty({ required: false, example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: 'jean@example.com / +257 123 456' })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiProperty({
    enum: ['tech', 'selection', 'behavior', 'corruption', 'vbg', 'other'],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['tech', 'selection', 'behavior', 'corruption', 'vbg', 'other'])
  type: 'tech' | 'selection' | 'behavior' | 'corruption' | 'vbg' | 'other';

  @ApiProperty({ required: false, example: '2026-05-09' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false, example: 'Bujumbura' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'Description détaillée des faits...' })
  @IsNotEmpty()
  @IsString()
  description: string;
}
