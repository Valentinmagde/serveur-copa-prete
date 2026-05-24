import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTrainingDto {
  @ApiProperty({ example: 'FORM-001' })
  @IsNotEmpty() @IsString()
  code: string;

  @ApiProperty({ example: 'Introduction à l\'entrepreneuriat' })
  @IsNotEmpty() @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  objectives?: string;

  @ApiProperty({ required: false, example: 8 })
  @IsOptional() @IsNumber()
  durationHours?: number;

  @ApiProperty({ required: false, example: 'PRESENTIEL' })
  @IsOptional() @IsString()
  format?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  detailedProgram?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  prerequisites?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  targetAudience?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional() @IsBoolean()
  isCopaMandatory?: boolean;
}
