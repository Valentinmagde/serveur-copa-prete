import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';
import { CopaEditionsService } from './copa-editions.service';
import { Gender } from './entities/gender.entity';
import { Province } from './entities/province.entity';
import { Commune } from './entities/commune.entity';
import { BusinessSector } from './entities/business-sector.entity';
import { LegalForm } from './entities/legal-form.entity';
import { Status } from './entities/status.entity';
import { CopaEdition } from './entities/copa-edition.entity';
import { Role } from './entities/role.entity';
import { ConsentType } from './entities/consent-type.entity';
import { BusinessPlanSectionType } from './entities/business-plan-section-type.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { ComplaintType } from '../complaints/entities/complaint-type.entity';
import { CopaPhase } from './entities/copa-phase.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Gender,
      Province,
      Commune,
      BusinessSector,
      LegalForm,
      Status,
      CopaEdition,
      CopaPhase,
      Role,
      ConsentType,
      BusinessPlanSectionType,
      DocumentType,
      ComplaintType,
    ]),
  ],
  controllers: [ReferenceController],
  providers: [ReferenceService, CopaEditionsService],
  exports: [ReferenceService, CopaEditionsService],
})
export class ReferenceModule {}
