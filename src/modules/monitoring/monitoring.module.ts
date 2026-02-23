import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringIndicator } from './entities/monitoring-indicator.entity';
import { IndicatorMeasurement } from './entities/indicator-measurement.entity';
import { BeneficiariesModule } from '../beneficiaries/beneficiaries.module';
import { BusinessPlansModule } from '../business-plans/business-plans.module';
import { SubventionsModule } from '../subventions/subventions.module';
import { ComplaintsModule } from '../complaints/complaints.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitoringIndicator, IndicatorMeasurement]),
    BeneficiariesModule,
    BusinessPlansModule,
    SubventionsModule,
    ComplaintsModule,
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
