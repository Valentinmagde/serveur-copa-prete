import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt } from 'class-validator';

export class UpdateBeneficiaryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  companyId?: number;
}
