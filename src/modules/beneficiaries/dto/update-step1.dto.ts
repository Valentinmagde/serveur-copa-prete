import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsBoolean,
} from 'class-validator';

export class UpdateStep1Dto {
  @ApiProperty({
    description: 'Statut du candidat',
    enum: ['burundais', 'refugie'],
    example: 'burundais',
  })
  @IsIn(['burundais', 'refugie'])
  status: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(2)
  @Matches(/^[a-zA-ZÀ-ÿ\s-]+$/, {
    message: 'Le prénom ne doit contenir que des lettres',
  })
  firstName: string;

  @ApiProperty({ example: 'Nduwayo' })
  @IsString()
  @MinLength(2)
  @Matches(/^[a-zA-ZÀ-ÿ\s-]+$/, {
    message: 'Le nom ne doit contenir que des lettres',
  })
  lastName: string;

  @ApiProperty({ example: 'Directeur Général', required: false })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({
    description: 'Sexe',
    enum: ['M', 'F'],
    example: 'M',
  })
  @IsIn(['M', 'F'])
  gender: string;

  @ApiProperty({ example: '1990-05-15' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({
    description: 'Situation matrimoniale',
    enum: ['single', 'married', 'divorced', 'widowed'],
    example: 'married',
    required: false,
  })
  @IsOptional()
  @IsIn(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @ApiProperty({
    description: "Niveau d'éducation",
    enum: ['none', 'primary', 'secondary', 'university'],
    example: 'university',
    required: false,
  })
  @IsOptional()
  @IsIn(['none', 'primary', 'secondary', 'university'])
  educationLevel?: string;

  @ApiProperty({ example: 'jean.nduwayo@email.com' })
  @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: "Format d'email invalide",
  })
  email: string;

  @ApiProperty({ example: '79912345' })
  @IsString()
  @Matches(/^(79|76|75|72|71|77|78|73|74)\d{7}$|^\+257[0-9]{8}$/, {
    message: 'Le téléphone doit être au format 79xxxxxxx ou +257xxxxxxxx',
  })
  phone: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  provinceId: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  communeId: number;

  @ApiProperty({ example: 'Colline Kanyosha', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'Zone Nord', required: false })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublicServant?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRelativeOfPublicServant?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublicIntern?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRelativeOfPublicIntern?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  wasHighOfficer?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRelativeOfHighOfficer?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasProjectLink?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDirectSupplierToProject?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasPreviousGrant?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  previousGrantDetails?: string;

  @ApiProperty({ example: 'Test@123', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Le mot de passe doit contenir 8 caractères minimum, une majuscule et un chiffre',
  })
  password?: string;

  @ApiProperty({ example: 'Test@123', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  passwordConfirmation?: string;
}
