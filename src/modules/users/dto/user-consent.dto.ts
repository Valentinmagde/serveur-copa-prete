import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt } from 'class-validator';

export class UserConsentDto {
  @ApiProperty()
  @IsInt()
  consentTypeId: number;

  @ApiProperty()
  @IsBoolean()
  value: boolean;
}
