import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsNumber,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationType,
} from './create-notification.dto';

export class SendBulkDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'IDs des destinataires',
    example: [1, 2, 3, 4, 5],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  recipientIds: number[];

  @ApiProperty({
    required: false,
    description: 'Données supplémentaires pour personnalisation',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiProperty({
    required: false,
    description: 'Template à utiliser',
  })
  @IsOptional()
  @IsString()
  template?: string;
}
