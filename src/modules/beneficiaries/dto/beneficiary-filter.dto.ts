import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsString,
  IsBoolean,
  IsDateString,
  IsIn,
  Min,
  IsNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class BeneficiaryFilterDto {
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
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  statusId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isProfileComplete?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  companyId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  provinceId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(['BURUNDIAN', 'REFUGEE'])
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsIn(['formal', 'informal', 'project'])
  companyType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minCompletion?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isSelected?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPreSelected?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fromDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  toDate?: Date;

  @IsOptional() @IsString() legalStatus?: string;
  @IsOptional() @IsString() sector?: string;
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isWomanLed?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isRefugeeLed?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  hasClimateImpact?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;
}
