import { ApiProperty } from '@nestjs/swagger';
import { UpdateStep1Dto } from './update-step1.dto';
import { UpdateStep2Dto } from './update-step2.dto';
import { UpdateStep3Dto } from './update-step3.dto';

export class UpdateBeneficiaryDto {
  @ApiProperty({ description: 'Step 1' })
  step1: UpdateStep1Dto;

  @ApiProperty({ description: 'Step 2' })
  step2: UpdateStep2Dto;

  @ApiProperty({ description: 'Step 3' })
  step3: UpdateStep3Dto;
}
