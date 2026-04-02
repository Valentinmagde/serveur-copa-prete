import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UserFilterDto {
  @ApiProperty({ enum: ['Active', 'Deactivated', 'Pending'], required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    enum: ['SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER', 'EVALUATOR', 'TRAINER', 'MENTOR', 'PARTNER'],
    required: false
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
