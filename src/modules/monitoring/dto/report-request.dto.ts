import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsInt,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReportRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  indicatorIds?: number[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  copaEditionId?: number;

  @ApiProperty()
  @IsDateString()
  startDate: Date;

  @ApiProperty()
  @IsDateString()
  endDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  format?: string;
}
