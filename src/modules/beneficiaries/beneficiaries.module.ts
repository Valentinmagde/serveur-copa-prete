import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import { Beneficiary } from './entities/beneficiary.entity';
import { UsersModule } from '../users/users.module';
import { CompaniesModule } from '../companies/companies.module';
import { Status } from '../reference/entities/status.entity';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { ProfileCompletionService } from './profile-completion.service';

@Module({
  imports: [
    UsersModule,
    CompaniesModule,
    TypeOrmModule.forFeature([User, Beneficiary, Company, Status]),
  ],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService, ProfileCompletionService],
  exports: [BeneficiariesService, ProfileCompletionService],
})
export class BeneficiariesModule {}
