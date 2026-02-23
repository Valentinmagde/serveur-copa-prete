import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SubmitBusinessPlanDto {
  @ApiProperty()
  @IsBoolean()
  confirmSubmission: boolean;
}
