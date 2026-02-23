import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkReadDto {
  @ApiProperty({
    required: false,
    description: 'IDs des notifications à marquer comme lues',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  notificationIds?: number[];

  @ApiProperty({
    required: false,
    description: 'Marquer toutes les notifications comme lues',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  markAll?: boolean;
}
