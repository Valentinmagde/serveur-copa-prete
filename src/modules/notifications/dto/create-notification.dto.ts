import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsBoolean,
  IsEmail,
  ValidateIf,
} from 'class-validator';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
  WHATSAPP = 'WHATSAPP',
  USSD = 'USSD',
}

export enum NotificationType {
  CONFIRMATION = 'CONFIRMATION',
  REMINDER = 'REMINDER',
  ALERT = 'ALERT',
  INFORMATION = 'INFORMATION',
  PROMOTION = 'PROMOTION',
}

export class CreateNotificationDto {
  @ApiProperty({
    enum: NotificationChannel,
    description: 'Canal de notification',
    example: NotificationChannel.EMAIL,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    enum: NotificationType,
    description: 'Type de notification',
    example: NotificationType.CONFIRMATION,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Titre de la notification',
    example: 'Bienvenue sur COPA',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Contenu de la notification',
    example: 'Votre inscription a été réussie...',
  })
  @IsString()
  content: string;

  @ApiProperty({
    required: false,
    description: 'ID du destinataire (si utilisateur connu)',
    example: 42,
  })
  @IsOptional()
  @IsNumber()
  recipientId?: number;

  @ApiProperty({
    required: false,
    description: 'Email du destinataire',
    example: 'user@example.com',
  })
  @ValidateIf((o) => !o.recipientId && !o.recipientPhone)
  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

  @ApiProperty({
    required: false,
    description: 'Téléphone du destinataire',
    example: '79912345',
  })
  @ValidateIf((o) => !o.recipientId && !o.recipientEmail)
  @IsString()
  @IsOptional()
  recipientPhone?: string;

  @ApiProperty({
    required: false,
    description: 'Données supplémentaires pour templates',
    example: { firstName: 'Jean', loginUrl: 'https://copa.bi/login' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiProperty({
    required: false,
    description: 'Template à utiliser',
    example: 'welcome',
  })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiProperty({
    required: false,
    description: 'Haute priorité',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isHighPriority?: boolean;

  @ApiProperty({
    required: false,
    description: "Date d'envoi programmée",
    example: '2026-03-01T09:00:00Z',
  })
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}
