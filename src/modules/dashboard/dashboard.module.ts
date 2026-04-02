import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { User } from '../users/entities/user.entity';
import { BusinessPlan } from '../business-plans/entities/business-plan.entity';
import { BusinessSector } from '../reference/entities/business-sector.entity';
import { Status } from '../reference/entities/status.entity';
import { Province } from '../reference/entities/province.entity';
import { Commune } from '../reference/entities/commune.entity';
import { Gender } from '../reference/entities/gender.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Beneficiary,
            User,
            BusinessPlan,
            BusinessSector,
            Status,
            Province,
            Commune,
            Gender,
        ]),
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
    exports: [DashboardService],
})
export class DashboardModule { }