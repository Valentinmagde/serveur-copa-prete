import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordMeasurementDto {
  @ApiProperty()
  @IsInt()
  indicatorId: number;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  measurementDate: Date;

  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  disaggregationDimension?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  disaggregationValue?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  copaEditionId?: number;
}
