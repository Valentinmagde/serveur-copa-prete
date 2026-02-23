import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString } from 'class-validator';

export class ValidateBeneficiaryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  companyId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
