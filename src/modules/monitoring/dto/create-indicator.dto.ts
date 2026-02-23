import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateIndicatorDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  measurementFrequency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  requiresGenderDisaggregation?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;
}
