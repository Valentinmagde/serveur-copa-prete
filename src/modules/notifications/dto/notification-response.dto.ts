import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationChannel,
  NotificationType,
} from './create-notification.dto';

export class NotificationResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: NotificationChannel })
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  recipientUserId: number;

  @ApiProperty()
  isSent: boolean;

  @ApiProperty()
  sentAt: Date;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  readAt: Date;

  @ApiProperty()
  data: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
