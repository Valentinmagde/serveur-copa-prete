import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gender } from './entities/gender.entity';
import { Province } from './entities/province.entity';
import { Commune } from './entities/commune.entity';
import { BusinessSector } from './entities/business-sector.entity';
import { LegalForm } from './entities/legal-form.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { ComplaintType } from '../complaints/entities/complaint-type.entity';
import { Status } from './entities/status.entity';
import { CopaEdition } from './entities/copa-edition.entity';
import { Role } from './entities/role.entity';
import { ConsentType } from './entities/consent-type.entity';
import { BusinessPlanSectionType } from './entities/business-plan-section-type.entity';
import { CopaPhase } from './entities/copa-phase.entity';

@Injectable()
export class ReferenceService {
  constructor(
    @InjectRepository(Gender)
    private readonly genderRepository: Repository<Gender>,
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Commune)
    private readonly communeRepository: Repository<Commune>,
    @InjectRepository(BusinessSector)
    private readonly businessSectorRepository: Repository<BusinessSector>,
    @InjectRepository(LegalForm)
    private readonly legalFormRepository: Repository<LegalForm>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(ComplaintType)
    private readonly complaintTypeRepository: Repository<ComplaintType>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
    @InjectRepository(CopaEdition)
    private readonly copaEditionRepository: Repository<CopaEdition>,
    @InjectRepository(CopaPhase)
    private readonly copaPhaseRepository: Repository<CopaPhase>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(ConsentType)
    private readonly consentTypeRepository: Repository<ConsentType>,
    @InjectRepository(BusinessPlanSectionType)
    private readonly businessPlanSectionTypeRepository: Repository<BusinessPlanSectionType>,
  ) {}

  async getGenders(): Promise<Gender[]> {
    return this.genderRepository.find({ order: { code: 'ASC' } });
  }

  async getProvinces(): Promise<Province[]> {
    return this.provinceRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getCommunesByProvince(provinceId: number): Promise<Commune[]> {
    return this.communeRepository.find({
      where: { provinceId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getBusinessSectors(
    eligibleOnly: boolean = false,
  ): Promise<BusinessSector[]> {
    const where: any = { isActive: true };
    if (eligibleOnly) {
      where.isCopaEligible = true;
    }
    return this.businessSectorRepository.find({
      where,
      order: { nameFr: 'ASC' },
    });
  }

  async getLegalForms(): Promise<LegalForm[]> {
    return this.legalFormRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getDocumentTypes(): Promise<DocumentType[]> {
    return this.documentTypeRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getComplaintTypes(): Promise<ComplaintType[]> {
    return this.complaintTypeRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getStatusesByEntityType(entityType: string): Promise<Status[]> {
    return this.statusRepository.find({
      where: { entityType, isActive: true },
      order: { displayOrder: 'ASC' },
    });
  }

  async getCopaEditions(activeOnly: boolean = false): Promise<CopaEdition[]> {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    return this.copaEditionRepository.find({
      where,
      order: { year: 'DESC' },
    });
  }

  async getCurrentCopaEditions(): Promise<CopaEdition[] | null> {
    return this.copaEditionRepository.find({
      where: { isActive: true },
      order: { year: 'DESC' },
    });
  }

  async getCopaPhases(activeOnly: boolean = false): Promise<CopaPhase[]> {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    return this.copaPhaseRepository.find({
      where,
      order: { startDate: 'DESC' },
      relations: ['copaEdition'],
    });
  }

  async getCurrentCopaPhases(): Promise<CopaPhase[] | null> {
    return this.copaPhaseRepository.find({
      where: { isActive: true },
      order: { startDate: 'DESC' },
      relations: ['copaEdition'],
    });
  }

  async getRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isActive: true },
      order: { level: 'DESC' },
    });
  }

  async getConsentTypes(): Promise<ConsentType[]> {
    return this.consentTypeRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async getBusinessPlanSectionTypes(): Promise<BusinessPlanSectionType[]> {
    return this.businessPlanSectionTypeRepository.find({
      order: { displayOrder: 'ASC' },
    });
  }
}
