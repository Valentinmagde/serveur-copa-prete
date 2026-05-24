import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitEvaluationDto {
  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  businessPlanId: number;

  @ApiProperty({ minimum: 0, maximum: 25 })
  @IsNumber() @Min(0) @Max(25)
  economicViabilityScore: number;

  @ApiProperty({ minimum: 0, maximum: 20 })
  @IsNumber() @Min(0) @Max(20)
  innovationScore: number;

  @ApiProperty({ minimum: 0, maximum: 15 })
  @IsNumber() @Min(0) @Max(15)
  qualityScore: number;

  @ApiProperty({ minimum: 0, maximum: 20 })
  @IsNumber() @Min(0) @Max(20)
  implementationCapacityScore: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber() @Min(0) @Max(10)
  socialImpactScore: number;

  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber() @Min(0) @Max(10)
  environmentalImpactScore: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  globalComment?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  strengths?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  weaknesses?: string;

  @ApiProperty({ enum: ['STRONGLY_RECOMMENDED', 'RECOMMENDED', 'RECOMMENDED_WITH_RESERVES', 'NOT_RECOMMENDED'] })
  @IsNotEmpty() @IsString()
  @IsIn(['STRONGLY_RECOMMENDED', 'RECOMMENDED', 'RECOMMENDED_WITH_RESERVES', 'NOT_RECOMMENDED'])
  recommendation: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  conflictOfInterestDeclared: boolean;
}
