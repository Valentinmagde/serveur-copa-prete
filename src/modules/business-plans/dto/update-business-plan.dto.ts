import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsNumber, Min } from 'class-validator';

export class UpdateBusinessPlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectDescription?: string;

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
}
