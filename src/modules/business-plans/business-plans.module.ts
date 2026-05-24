import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessPlansController } from './business-plans.controller';
import { BusinessPlansService } from './business-plans.service';
import { BusinessPlan } from './entities/business-plan.entity';
import { BusinessPlanSection } from './entities/business-plan-section.entity';
import { BeneficiariesModule } from '../beneficiaries/beneficiaries.module';
import { ReferenceModule } from '../reference/reference.module';
import { Status } from '../reference/entities/status.entity';
import { BusinessPlanSectionType } from '../reference/entities/business-plan-section-type.entity';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessPlan,
      BusinessPlanSection,
      Status,
      BusinessPlanSectionType,
    ]),
    BeneficiariesModule,
    ReferenceModule,
    DocumentsModule,
    NotificationsModule,
  ],
  controllers: [BusinessPlansController],
  providers: [BusinessPlansService],
  exports: [BusinessPlansService],
})
export class BusinessPlansModule {}
