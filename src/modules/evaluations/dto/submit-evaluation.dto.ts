import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitEvaluationDto {
  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  businessPlanId: number;

  // A. L'objectif et l'idée de projet
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion1Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion2Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion3Score: number;

  // B. Stratégie et plan marketing
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion4Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion5Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion6Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion7Score: number;

  // C. Moyens techniques
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion8Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion9Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion10Score: number;

  // D. Impact environnemental et social
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion11Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion12Score: number;

  // E. Études économiques et financières
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion13Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion14Score: number;
  @ApiProperty({ minimum: 0, maximum: 5 }) @IsNumber() @Min(0) @Max(5) criterion15Score: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  globalComment?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsObject()
  criteriaComments?: Record<string, string>;

  @ApiProperty({ enum: ['STRONGLY_RECOMMENDED', 'RECOMMENDED', 'RECOMMENDED_WITH_RESERVES', 'NOT_RECOMMENDED'], required: false })
  @IsOptional() @IsString()
  @IsIn(['STRONGLY_RECOMMENDED', 'RECOMMENDED', 'RECOMMENDED_WITH_RESERVES', 'NOT_RECOMMENDED'])
  recommendation?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  conflictOfInterestDeclared: boolean;
}
