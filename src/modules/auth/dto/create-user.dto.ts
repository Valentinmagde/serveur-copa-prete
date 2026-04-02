import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsString,
    IsOptional,
    IsBoolean,
    IsArray,
    MinLength,
    MaxLength,
    IsEnum,
    IsInt,
    Min,
    Max,
} from 'class-validator';

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    PENDING = 'pending',
}

export class CreateUserDto {
    @ApiProperty({ description: 'Prénom de l\'utilisateur' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    firstName: string;

    @ApiProperty({ description: 'Nom de famille' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    lastName: string;

    @ApiProperty({ description: 'Adresse email' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Mot de passe' })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({ description: 'Numéro de téléphone', required: false })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiProperty({ description: 'Rôle à assigner' })
    @IsString()
    roleCode: string; // Code du rôle (SUPER_ADMIN, ADMIN, etc.)

    @ApiProperty({ description: 'Statut de l\'utilisateur', enum: UserStatus, default: UserStatus.ACTIVE })
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @ApiProperty({ description: 'ID de l\'édition COPA', required: false })
    @IsOptional()
    @IsInt()
    copaEditionId?: number;

    @ApiProperty({ description: 'Commentaire d\'assignation', required: false })
    @IsOptional()
    @IsString()
    assignmentReason?: string;
}
