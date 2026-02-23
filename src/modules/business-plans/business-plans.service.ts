import {
  Injectable,
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

@Injectable()
export class BusinessPlansService {
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
      .leftJoinAndSelect('plan.status', 'status');

    if (search) {
      queryBuilder.andWhere(
        '(plan.projectTitle ILIKE :search OR plan.referenceNumber ILIKE :search)',
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
    if (businessPlan.beneficiaryId !== beneficiary.id) {
      throw new ForbiddenException(
        'You can only submit your own business plans',
      );
    }

    // Check if already submitted
    if (businessPlan.submittedAt) {
      throw new BadRequestException('Business plan already submitted');
    }

    // Get submitted status
    const submittedStatus = await this.statusRepository.findOne({
      where: { code: 'SUBMITTED', entityType: 'BUSINESS_PLAN' },
    });

    if (submittedStatus) {
      businessPlan.statusId = submittedStatus.id;
    }
    businessPlan.submittedAt = new Date();
    businessPlan.submittedByUserId = userId;
    businessPlan.isFinalVersion = true;

    const updated = await this.businessPlanRepository.save(businessPlan);
    return this.findById(updated.id);
  }

  async getSections(id: number): Promise<BusinessPlanSection[]> {
    await this.findById(id);

    return await this.sectionRepository.find({
      where: { businessPlanId: id },
      relations: ['sectionType'],
      order: { sectionOrder: 'ASC' },
    });
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
}
