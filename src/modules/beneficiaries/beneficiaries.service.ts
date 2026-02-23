import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';

import { Beneficiary } from './entities/beneficiary.entity';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
  BeneficiaryFilterDto,
  ValidateBeneficiaryDto,
} from './dto';
import {
  PaginationUtil,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { Status } from '../reference/entities/status.entity';

@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepository: Repository<Beneficiary>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
  ) {}

  async create(
    createBeneficiaryDto: CreateBeneficiaryDto,
  ): Promise<Beneficiary> {
    // Check if user exists
    await this.usersService.findById(createBeneficiaryDto.userId);

    // Check if beneficiary already exists for this user
    const existingBeneficiary = await this.beneficiaryRepository.findOne({
      where: { userId: createBeneficiaryDto.userId },
    });

    if (existingBeneficiary) {
      throw new BadRequestException('Beneficiary already exists for this user');
    }

    // Get default status
    const defaultStatus = await this.statusRepository.findOne({
      where: { code: 'REGISTERED', entityType: 'BENEFICIARY' },
    });

    const beneficiaryData = {
      ...createBeneficiaryDto,
      statusId: defaultStatus?.id,
    };

    const beneficiary = this.beneficiaryRepository.create(beneficiaryData);
    const savedBeneficiary = await this.beneficiaryRepository.save(beneficiary);
    return this.findById(savedBeneficiary.id);
  }

  async findAll(
    filterDto: BeneficiaryFilterDto,
  ): Promise<PaginatedResult<Beneficiary>> {
    const {
      page = 1,
      limit = 10,
      search,
      statusId,
      companyId,
      fromDate,
      toDate,
    } = filterDto;

    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const queryBuilder = this.beneficiaryRepository
      .createQueryBuilder('beneficiary')
      .leftJoinAndSelect('beneficiary.user', 'user')
      .leftJoinAndSelect('beneficiary.company', 'company')
      .leftJoinAndSelect('beneficiary.status', 'status');

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (statusId) {
      queryBuilder.andWhere('beneficiary.statusId = :statusId', { statusId });
    }

    if (companyId) {
      queryBuilder.andWhere('beneficiary.companyId = :companyId', {
        companyId,
      });
    }

    if (fromDate) {
      queryBuilder.andWhere('beneficiary.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('beneficiary.createdAt <= :toDate', { toDate });
    }

    const [beneficiaries, total] = await queryBuilder
      .orderBy('beneficiary.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return PaginationUtil.paginate(beneficiaries, total, { page, limit });
  }

  async findById(id: number, relations: string[] = []): Promise<Beneficiary> {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { id },
      relations: [
        'user',
        'company',
        'status',
        'subscriptionStatus',
        ...relations,
      ],
    });

    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary with ID ${id} not found`);
    }

    return beneficiary;
  }

  async findByUserId(userId: number): Promise<Beneficiary> {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { userId },
      relations: ['user', 'company', 'status'],
    });

    if (!beneficiary) {
      throw new NotFoundException(
        `Beneficiary for user ID ${userId} not found`,
      );
    }

    return beneficiary;
  }

  async update(
    id: number,
    updateBeneficiaryDto: UpdateBeneficiaryDto,
  ): Promise<Beneficiary> {
    const beneficiary = await this.findById(id);
    Object.assign(beneficiary, updateBeneficiaryDto);
    const updated = await this.beneficiaryRepository.save(beneficiary);
    return this.findById(updated.id);
  }

  async validate(
    id: number,
    validateDto: ValidateBeneficiaryDto,
    validatorUserId: number,
  ): Promise<Beneficiary> {
    const beneficiary = await this.findById(id);

    const status = await this.statusRepository.findOne({
      where: { code: 'VALIDATED', entityType: 'BENEFICIARY' },
    });

    if (!status) {
      throw new BadRequestException('Validation status not found');
    }

    beneficiary.statusId = status.id;
    beneficiary.validatedAt = new Date();
    beneficiary.validatedByUserId = validatorUserId;

    const updated = await this.beneficiaryRepository.save(beneficiary);
    return this.findById(updated.id);
  }
}
