import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { BusinessPlan } from './entities/business-plan.entity';
import { BusinessPlanSection } from './entities/business-plan-section.entity';
import {
  CreateBusinessPlanDto,
  UpdateBusinessPlanDto,
  SubmitBusinessPlanDto,
  BusinessPlanFilterDto,
} from './dto';
import {
  PaginationUtil,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { BeneficiariesService } from '../beneficiaries/beneficiaries.service';
import { CopaEditionsService } from '../reference/copa-editions.service';
import { Status } from '../reference/entities/status.entity';
import { BusinessPlanSectionType } from '../reference/entities/business-plan-section-type.entity';
import { DocumentsService } from '../documents/documents.service';
import { Document } from '../documents/entities/document.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BusinessPlansService {
  private readonly logger = new Logger(BusinessPlansService.name);

  constructor(
    @InjectRepository(BusinessPlan)
    private readonly businessPlanRepository: Repository<BusinessPlan>,
    @InjectRepository(BusinessPlanSection)
    private readonly sectionRepository: Repository<BusinessPlanSection>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
    @InjectRepository(BusinessPlanSectionType)
    private readonly sectionTypeRepository: Repository<BusinessPlanSectionType>,
    private readonly beneficiariesService: BeneficiariesService,
    private readonly copaEditionsService: CopaEditionsService,
    private readonly dataSource: DataSource,
    private readonly documentsService: DocumentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    createDto: CreateBusinessPlanDto,
    userId: number,
  ): Promise<BusinessPlan> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if beneficiary exists and belongs to user
      const beneficiary = await this.beneficiariesService.findByUserId(userId);

      // Check if COPA edition is active and accepting submissions
      const edition = await this.copaEditionsService.findById(
        createDto.copaEditionId,
      );
      if (!edition.isActive) {
        throw new BadRequestException('This COPA edition is not active');
      }

      const now = new Date();
      if (
        now < edition.submissionStartDate ||
        now > edition.submissionEndDate
      ) {
        throw new BadRequestException(
          'Submissions are not currently being accepted for this edition',
        );
      }

      // Get draft status
      const draftStatus = await this.statusRepository.findOne({
        where: { code: 'DRAFT', entityType: 'BUSINESS_PLAN' },
      });

      // Create business plan
      const businessPlanData = {
        ...createDto,
        beneficiaryId: beneficiary.id,
        statusId: draftStatus?.id,
        lastModifiedAt: new Date(),
      };

      const businessPlan = this.businessPlanRepository.create(businessPlanData);
      const savedBusinessPlan = await queryRunner.manager.save(
        BusinessPlan,
        businessPlan,
      );

      // Create sections if provided
      if (createDto.sections && createDto.sections.length > 0) {
        for (let i = 0; i < createDto.sections.length; i++) {
          const section = createDto.sections[i];
          const sectionData = {
            ...section,
            businessPlanId: savedBusinessPlan.id,
            sectionOrder: i + 1,
          };
          const sectionEntity = this.sectionRepository.create(sectionData);
          await queryRunner.manager.save(BusinessPlanSection, sectionEntity);
        }
      }

      await queryRunner.commitTransaction();
      return this.findById(savedBusinessPlan.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    filterDto: BusinessPlanFilterDto,
  ): Promise<PaginatedResult<BusinessPlan>> {
    const {
      page = 1,
      limit = 10,
      search,
      statusId,
      copaEditionId,
      beneficiaryId,
      businessSectorId,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
    } = filterDto;

    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const queryBuilder = this.businessPlanRepository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.beneficiary', 'beneficiary')
      .leftJoinAndSelect('beneficiary.user', 'user')
      .leftJoinAndSelect('plan.copaEdition', 'copaEdition')
      .leftJoinAndSelect('plan.businessSector', 'businessSector')
      .leftJoinAndSelect('plan.status', 'status')
      .where('plan.isFinalVersion = true');

    if (search) {
      queryBuilder.andWhere(
        '(plan.projectTitle ILIKE :search OR plan.referenceNumber ILIKE :search OR beneficiary.applicationCode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (statusId) {
      queryBuilder.andWhere('plan.statusId = :statusId', { statusId });
    }

    if (copaEditionId) {
      queryBuilder.andWhere('plan.copaEditionId = :copaEditionId', {
        copaEditionId,
      });
    }

    if (beneficiaryId) {
      queryBuilder.andWhere('plan.beneficiaryId = :beneficiaryId', {
        beneficiaryId,
      });
    }

    if (businessSectorId) {
      queryBuilder.andWhere('plan.businessSectorId = :businessSectorId', {
        businessSectorId,
      });
    }

    if (fromDate) {
      queryBuilder.andWhere('plan.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('plan.createdAt <= :toDate', { toDate });
    }

    if (minAmount) {
      queryBuilder.andWhere('plan.requestedFundingAmount >= :minAmount', {
        minAmount,
      });
    }

    if (maxAmount) {
      queryBuilder.andWhere('plan.requestedFundingAmount <= :maxAmount', {
        maxAmount,
      });
    }

    const [plans, total] = await queryBuilder
      .orderBy('plan.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return PaginationUtil.paginate(plans, total, { page, limit });
  }

  async findMyBusinessPlan(userId: number): Promise<BusinessPlan | null> {
    const beneficiary = await this.beneficiariesService.findByUserId(userId);

    return this.businessPlanRepository.findOne({
      where: { beneficiaryId: beneficiary.id },
      relations: ['status', 'copaEdition'],
      order: { createdAt: 'DESC' },
    });
  }

  async initializeMyDraft(userId: number): Promise<BusinessPlan> {
    const beneficiary = await this.beneficiariesService.findByUserId(userId);

    const existing = await this.businessPlanRepository.findOne({
      where: { beneficiaryId: beneficiary.id },
      relations: ['status', 'copaEdition'],
      order: { createdAt: 'DESC' },
    });
    if (existing) return this.findById(existing.id);

    const activeEditions = await this.copaEditionsService.findActive();
    if (!activeEditions.length) {
      throw new BadRequestException(
        "Aucune édition COPA active. L'upload n'est pas disponible pour le moment.",
      );
    }

    const draftStatus = await this.statusRepository.findOne({
      where: { code: 'DRAFT', entityType: 'BUSINESS_PLAN' },
    });

    const plan = this.businessPlanRepository.create({
      referenceNumber: await this.generateReferenceNumber(beneficiary),
      copaEditionId: activeEditions[0].id,
      beneficiaryId: beneficiary.id,
      projectTitle: beneficiary.projectTitle || "Plan d'affaires",
      projectDescription: beneficiary.projectObjective || null,
      statusId: draftStatus?.id,
      lastModifiedAt: new Date(),
    });

    const saved = await this.businessPlanRepository.save(plan);
    return this.findById(saved.id);
  }

  private async generateReferenceNumber(beneficiary: any): Promise<string> {
    const count = await this.businessPlanRepository.count();
    const sequence = (count + 1).toString().padStart(5, '0');

    const isRefugee = beneficiary.category === 'REFUGEE';
    const isFemale = beneficiary.user?.gender?.code?.toUpperCase() === 'F';

    let suffix: string;
    if (isRefugee && isFemale) suffix = 'CRF';
    else if (isRefugee && !isFemale) suffix = 'CRH';
    else if (!isRefugee && isFemale) suffix = 'COF';
    else suffix = 'COH';

    return `${sequence}${suffix}`;
  }

  async findById(id: number, relations: string[] = []): Promise<BusinessPlan> {
    const businessPlan = await this.businessPlanRepository.findOne({
      where: { id },
      relations: [
        'beneficiary',
        'beneficiary.user',
        'copaEdition',
        'businessSector',
        'status',
        'sections',
        'sections.sectionType',
        ...relations,
      ],
    });

    if (!businessPlan) {
      throw new NotFoundException(`Business plan with ID ${id} not found`);
    }

    return businessPlan;
  }

  async update(
    id: number,
    updateDto: UpdateBusinessPlanDto,
    userId: number,
  ): Promise<BusinessPlan> {
    const businessPlan = await this.findById(id);

    // Check if plan can be edited
    if (businessPlan.isFinalVersion) {
      throw new BadRequestException('Cannot edit a finalized business plan');
    }

    if (businessPlan.submittedAt) {
      throw new BadRequestException('Cannot edit a submitted business plan');
    }

    // Verify ownership
    const beneficiary = await this.beneficiariesService.findByUserId(userId);
    if (businessPlan.beneficiaryId !== beneficiary.id) {
      throw new ForbiddenException('You can only edit your own business plans');
    }

    Object.assign(businessPlan, updateDto);
    businessPlan.lastModifiedAt = new Date();

    const updated = await this.businessPlanRepository.save(businessPlan);
    return this.findById(updated.id);
  }

  async submit(
    id: number,
    submitDto: SubmitBusinessPlanDto,
    userId: number,
  ): Promise<BusinessPlan> {
    const businessPlan = await this.findById(id, ['sections']);

    // Verify ownership
    const beneficiary = await this.beneficiariesService.findByUserId(userId);
    // if (businessPlan.beneficiaryId !== beneficiary.id) {
    //   throw new ForbiddenException(
    //     'You can only submit your own business plans',
    //   );
    // }

    // if (businessPlan.submittedAt) {
    //   throw new BadRequestException('Ce plan d\'affaires a déjà été soumis');
    // }

    // Check if business plan document has been uploaded
    const documents = await this.documentsService.getDocumentsByEntity(
      id,
      'businessPlan',
      'businessPlan',
    );
    if (!documents || documents.length === 0) {
      throw new BadRequestException(
        'Vous devez uploader le document de votre plan d\'affaire avant de soumettre',
      );
    }

    // Get submitted status
    const submittedStatus = await this.statusRepository.findOne({
      where: { code: 'SUBMITTED', entityType: 'BUSINESS_PLAN' },
    });

    if (!submittedStatus) {
      throw new BadRequestException('Statut SUBMITTED introuvable en base de données');
    }

    await this.businessPlanRepository.update(id, {
      statusId: submittedStatus.id,
      submittedAt: new Date(),
      submittedByUserId: userId,
      isFinalVersion: true,
    });

    const result = await this.findById(id);

    // Envoi de l'accusé de réception par email (non bloquant)
    const user = businessPlan.beneficiary?.user;
    if (user?.email) {
      const montant = businessPlan.requestedFundingAmount
        ? new Intl.NumberFormat('fr-BI').format(businessPlan.requestedFundingAmount)
        : undefined;
      const dateResultats = result.copaEdition?.resultsPublicationDate
        ? new Date(result.copaEdition.resultsPublicationDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : undefined;

      this.notificationsService.sendBusinessPlanSubmittedEmail({
        userId: userId,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        dossierNumero: businessPlan?.beneficiary?.applicationCode,
        dateSoumission: new Date().toLocaleString('fr-FR'),
        secteur: businessPlan?.beneficiary?.projectSectors?.join(', '),
        montantDemande: montant,
        dateResultats,
      }).catch((err) =>
        this.logger?.error?.(`Échec envoi accusé de réception: ${err.message}`),
      );
    }

    return result;
  }

  async getSections(id: number): Promise<BusinessPlanSection[]> {
    await this.findById(id);

    return await this.sectionRepository.find({
      where: { businessPlanId: id },
      relations: ['sectionType'],
      order: { sectionOrder: 'ASC' },
    });
  }

  async getBusinessPlanDocument(
    id: number,
    userId?: number,
  ): Promise<Document | null> {
    const businessPlan = await this.findById(id);

    // if (userId) {
    //   const beneficiary = await this.beneficiariesService.findByUserId(userId);
    //   if (businessPlan.beneficiaryId !== beneficiary.id) {
    //     throw new ForbiddenException(
    //       'You can only access your own business plan documents',
    //     );
    //   }
    // }

    const documents = await this.documentsService.getDocumentsByEntity(
      id,
      'businessPlan',
      'businessPlan',
    );

    if (!documents || documents.length === 0) {
      return null;
    }

    // Return the most recent document
    return documents.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }

  async anonymize(id: number): Promise<BusinessPlan> {
    const bp = await this.businessPlanRepository.findOne({ where: { id } });
    if (!bp) throw new NotFoundException(`Plan d'affaires ${id} introuvable`);
    bp.isAnonymized = !bp.isAnonymized;
    return this.businessPlanRepository.save(bp);
  }

  async getEvaluationSummary(id: number): Promise<any> {
    const businessPlan = await this.findById(id, [
      'evaluations',
      'evaluations.evaluator',
      'evaluations.evaluator.user',
    ]);

    const evaluations =
      businessPlan.evaluations?.filter((e) => e.isFinalEvaluation) || [];

    if (evaluations.length === 0) {
      return { message: 'No evaluations yet' };
    }

    const totalScore = evaluations.reduce(
      (sum, e) => sum + (e.totalScore || 0),
      0,
    );
    const averageScore = totalScore / evaluations.length;

    return {
      totalEvaluations: evaluations.length,
      averageScore,
    };
  }

  async updateFinancialData(
    id: number,
    dto: {
      verifiedInvestmentSubsidy?: number;
      verifiedExploitationSubsidy?: number;
      verifiedFundingAmount?: number;
      verifiedTotalProjectCost?: number;
    },
    userId: number,
    bypassLock = false,
  ): Promise<BusinessPlan> {
    const plan = await this.businessPlanRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException("Plan d'affaires introuvable");

    if (
      !bypassLock &&
      plan.financialDataEvaluatorId &&
      plan.financialDataEvaluatorId !== userId
    ) {
      throw new ForbiddenException(
        'Les données financières ont déjà été saisies par un autre évaluateur',
      );
    }

    await this.businessPlanRepository.update(id, {
      ...(dto.verifiedInvestmentSubsidy !== undefined && {
        verifiedInvestmentSubsidy: dto.verifiedInvestmentSubsidy,
      }),
      ...(dto.verifiedExploitationSubsidy !== undefined && {
        verifiedExploitationSubsidy: dto.verifiedExploitationSubsidy,
      }),
      ...(dto.verifiedFundingAmount !== undefined && {
        verifiedFundingAmount: dto.verifiedFundingAmount,
      }),
      ...(dto.verifiedTotalProjectCost !== undefined && {
        verifiedTotalProjectCost: dto.verifiedTotalProjectCost,
      }),
      financialDataEvaluatorId: userId,
    });

    return this.businessPlanRepository.findOne({
      where: { id },
    }) as Promise<BusinessPlan>;
  }
}
