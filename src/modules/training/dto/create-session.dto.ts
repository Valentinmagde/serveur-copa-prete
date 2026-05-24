import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty()
  @IsNotEmpty() @IsNumber()
  trainingId: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  copaEditionId?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  primaryTrainerId?: number;

  @ApiProperty()
  @IsNotEmpty() @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsNotEmpty() @IsDateString()
  endDate: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  registrationDeadline?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  maxCapacity?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  physicalLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  meetingLink?: string;
}
