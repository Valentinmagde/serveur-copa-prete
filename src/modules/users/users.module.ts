import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UserConsent } from './entities/user-consent.entity';
import { Role } from '../reference/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, UserConsent, Role])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
