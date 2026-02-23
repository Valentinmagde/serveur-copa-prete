import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStep1Dto } from './register-step1.dto';
import { RegistrationStep2Dto } from './register-step2.dto';
import { RegistrationStep3Dto } from './register-step3.dto';

export class RegisterDto {
  @ApiProperty({ description: 'Step 1' })
  step1: RegistrationStep1Dto;

  @ApiProperty({ description: 'Step 2' })
  step2: RegistrationStep2Dto;

  @ApiProperty({ description: 'Step 3' })
  step3: RegistrationStep3Dto;
}
