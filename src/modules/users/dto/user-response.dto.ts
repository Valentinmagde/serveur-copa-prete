import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid?: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  birthDate?: Date;

  @ApiProperty()
  phoneNumber?: string;

  @ApiProperty()
  nationality?: string;

  @ApiProperty()
  role?: string;

  @ApiProperty()
  roleCode?: string;

  @ApiProperty()
  profilePhotoUrl?: string;

  @ApiProperty()
  status?: string;

  @ApiProperty()
  isRefugee?: boolean;

  @ApiProperty()
  isActive?: boolean;

  @ApiProperty()
  isVerified?: boolean;

  @ApiProperty()
  isBlocked?: boolean;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;
}
