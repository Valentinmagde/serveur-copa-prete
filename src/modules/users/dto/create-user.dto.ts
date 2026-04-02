import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
} from 'class-validator';

export enum UserStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
}

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Mot de passe' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  genderId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Rôle à assigner' })
  @IsString()
  roleCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiProperty({
    description: `Statut de l'utilisateur`,
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({
    description: `ID de l'édition COPA`,
    required: false,
  })
  @IsOptional()
  @IsInt()
  copaEditionId?: number;

  @ApiProperty({
    description: `Commentaire d'assignation`,
    required: false,
  })
  @IsOptional()
  @IsString()
  assignmentReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRefugee?: boolean;
}
