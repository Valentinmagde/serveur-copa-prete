import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegistrationMpmeDto {
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

  @ApiProperty({ example: 'jean.nduwayo@email.com' })
  @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: "Format d'email invalide",
  })
  email: string;

  @ApiProperty({ example: '79912345' })
  @IsString()
  // @Matches(/^(79|76|75|72|71|77|78|73|74)\d{7}$|^\+257[0-9]{8}$/, {
  //   message: 'Le téléphone doit être au format 79xxxxxxx ou +257xxxxxxxx',
  // })
  phone: string;

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

  @ApiProperty({ example: '1' })
  @IsNumber()
  copaEditionId: number;

  @ApiProperty({
    description: "Acceptation des Conditions Générales d'Utilisation",
    example: true,
  })
  @IsBoolean()
  acceptCGU: boolean;

  @ApiProperty({
    description: 'Acceptation de la Politique de Confidentialité',
    example: true,
  })
  @IsBoolean()
  acceptPrivacyPolicy: boolean;

  @ApiProperty({
    description: "Certification de l'exactitude des informations",
    example: true,
  })
  @IsBoolean()
  certifyAccuracy: boolean;
}
