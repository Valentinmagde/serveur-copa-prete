import { ApiProperty } from '@nestjs/swagger';

export class LoginStatsDto {
  @ApiProperty()
  totalAttempts: number;

  @ApiProperty()
  successfulAttempts: number;

  @ApiProperty()
  failedAttempts: number;

  @ApiProperty()
  successRate: number;

  @ApiProperty()
  lastLoginAt: Date | null;

  @ApiProperty()
  lastLoginIp: string | null;

  @ApiProperty()
  recentFailedAttempts: number;
}
