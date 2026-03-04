import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateStep3Dto {
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

  @ApiProperty({
    description: 'Opt-in pour recevoir des notifications',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  optInNotifications: boolean;

  @ApiProperty({
    description: 'Profil complet et soumis à la validation',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  isProfileCompleted: boolean;
}
