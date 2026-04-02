import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UserConsent } from './entities/user-consent.entity';
import { Role } from '../reference/entities/role.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { S3Service } from '../documents/storage/s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, UserConsent, Role]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, S3Service],
  exports: [UsersService, S3Service],
})
export class UsersModule {}
