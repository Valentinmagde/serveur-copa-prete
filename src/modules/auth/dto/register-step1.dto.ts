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
} from 'class-validator';

export class RegistrationStep1Dto {
  @ApiProperty({
    description: 'Statut du candidat',
    enum: ['burundais', 'refugie'],
    example: 'burundais',
  })
  @IsIn(['burundais', 'refugie'])
  status: string; // burundais ou refugie

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

  @ApiProperty({
    description: 'Sexe',
    enum: ['M', 'F'],
    example: 'M',
  })
  @IsIn(['M', 'F'])
  gender: string;

  @ApiProperty({ example: '1990-05-15' })
  @IsDateString()
  birthDate: string; // Format YYYY-MM-DD

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

  @ApiProperty({
    example: "Colline Kanyosha, près de l'école",
    required: false,
  })
  @IsOptional()
  @IsString()
  colline?: string;

  @ApiProperty({ example: 'Test@123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Le mot de passe doit contenir 8 caractères minimum, une majuscule et un chiffre',
  })
  password: string;

  @ApiProperty({ example: 'Test@123' })
  @IsString()
  @MinLength(8)
  passwordConfirmation: string;
}
