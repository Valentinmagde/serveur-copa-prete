import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  businessPlanId: number;

  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  evaluatorId: number;

  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  copaEditionId: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  deadline?: string;
}
