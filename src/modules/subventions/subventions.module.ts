import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubventionsController } from './subventions.controller';
import { SubventionsService } from './subventions.service';
import { Subvention } from './entities/subvention.entity';
import { SubventionTranche } from './entities/subvention-tranche.entity';
import { CreatedJob } from './entities/created-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subvention, SubventionTranche, CreatedJob]),
  ],
  controllers: [SubventionsController],
  providers: [SubventionsService],
  exports: [SubventionsService],
})
export class SubventionsModule {}
