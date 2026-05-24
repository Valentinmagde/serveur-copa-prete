import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSubventionDto {
  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  businessPlanId: number;

  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  beneficiaryId: number;

  @ApiProperty({ example: 5000000 })
  @IsNotEmpty() @IsNumber()
  awardedAmount: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  counterpartAmount?: number;

  @ApiProperty()
  @IsNotEmpty() @IsDateString()
  signatureDate: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  plannedEndDate?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  copaEditionId?: number;
}
