import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { TwilioService } from './twilio.service';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { SesEmailProvider } from './providers/ses-email.provider';
import { BrevoProvider } from './providers/brevo-provider';
import { ConfigModule } from '@nestjs/config';
import { EmailTemplatesService } from './templates/email-templates.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { UserConsent } from '../users/entities/user-consent.entity';
import { Role } from '../reference/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      User,
      UserRole,
      UserConsent,
      Role,
    ]),
    // UsersModule,
    forwardRef(() => UsersModule),
    ConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TwilioService,
    SesEmailProvider,
    BrevoProvider,
    EmailTemplatesService,
    UsersService,
  ],
  exports: [
    NotificationsService,
    TwilioService,
    EmailTemplatesService,
    UsersService,
  ],
})
export class NotificationsModule { }
