import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';

export class CreateBusinessPlanDto {
  @ApiProperty()
  @IsInt()
  copaEditionId: number;

  @ApiProperty()
  @IsString()
  projectTitle: string;

  @ApiProperty()
  @IsString()
  projectDescription: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  businessSectorId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedFundingAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  personalContributionAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedJobsCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedWomenJobsCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  sections?: any[];
}
