import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class CreateBeneficiaryDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  companyId?: number;
}
