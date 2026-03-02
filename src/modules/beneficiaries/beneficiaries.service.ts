import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
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
import { Status } from '../reference/entities/status.entity';
import { UpdateStep3Dto } from './dto/update-step3.dto';
import { User } from '../users/entities/user.entity';
import { Address } from '../reference/entities/address.entity';
import { Gender } from '../reference/entities/gender.entity';
import { capitalizeFirstLetter } from '@/utils/helpers';
import { Company } from '../companies/entities/company.entity';
import { UserConsent } from '../users/entities/user-consent.entity';
import { ConsentType } from '../reference/entities/consent-type.entity';
import { ProfileCompletionService } from './profile-completion.service';

@Injectable()
export class BeneficiariesService {
  private readonly logger = new Logger('Beneficiaries Service');

  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepository: Repository<Beneficiary>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
    private readonly usersService: UsersService,
    private dataSource: DataSource,
    @InjectRepository(User) private userRepo: Repository<User>,
    private profileCompletionService: ProfileCompletionService,
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

  async findByUserId(userId: number): Promise<any> {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { userId },
      relations: [
        'user',
        'user.consents',
        'user.consents.consentType',
        'user.primaryAddress',
        'user.gender',
        'company',
        'status',
      ],
    });

    if (!beneficiary) {
      throw new NotFoundException(
        `Beneficiary for user ID ${userId} not found`,
      );
    }

    const percentage =
      await this.profileCompletionService.calculateAndUpdateCompletion(
        beneficiary.id,
      );

    return {
      ...beneficiary,
      profileCompletion: percentage,
    };
  }

  // async update(
  //   id: number,
  //   updateBeneficiaryDto: UpdateBeneficiaryDto,
  // ): Promise<Beneficiary> {
  //   const beneficiary = await this.findById(id);
  //   Object.assign(beneficiary, updateBeneficiaryDto);
  //   const updated = await this.beneficiaryRepository.save(beneficiary);
  //   return this.findById(updated.id);
  // }

  async update(
    beneficiaryId: string,
    updateDto: UpdateBeneficiaryDto,
    ip: string,
    userAgent: string,
  ) {
    const { step1, step2, step3 } = updateDto;

    // Validation des étapes de mise à jour
    if (step1) {
      await this.validateStep1ForUpdate(step1, beneficiaryId);
    }
    if (step2) {
      this.validateStep2ForUpdate(step2);
    }
    if (step3) {
      this.validateStep3(step3);
    }

    // Démarrer la transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Récupérer le bénéficiaire avec toutes ses relations
      const beneficiaryRepo = queryRunner.manager.getRepository(Beneficiary);
      const existingBeneficiary = await beneficiaryRepo.findOne({
        where: { id: beneficiaryId as unknown as number },
        relations: ['user', 'user.primaryAddress', 'company', 'status'],
      });

      if (!existingBeneficiary) {
        throw new NotFoundException('Bénéficiaire non trouvé');
      }

      const user = existingBeneficiary.user;
      if (!user) {
        throw new NotFoundException('Utilisateur associé non trouvé');
      }

      // Mise à jour du mot de passe si fourni
      if (step1?.password) {
        user.passwordHash = await bcrypt.hash(step1.password, 10);
      }

      // Mise à jour de l'adresse
      if (step1 && (step1.provinceId || step1.communeId)) {
        const addressRepo = queryRunner.manager.getRepository(Address);

        if (user.primaryAddress) {
          // Mise à jour de l'adresse existante
          user.primaryAddress.provinceId =
            step1.provinceId ?? user.primaryAddress.provinceId;
          user.primaryAddress.communeId =
            step1.communeId ?? user.primaryAddress.communeId;
          const savedAddress = await queryRunner.manager.save(
            user.primaryAddress,
          );

          user.primaryAddress = savedAddress;
        } else {
          // Création d'une nouvelle adresse
          const address = addressRepo.create({
            provinceId: step1.provinceId,
            communeId: step1.communeId,
          });
          const savedAddress = await queryRunner.manager.save(address);
          user.primaryAddress = savedAddress;
        }

        await queryRunner.manager.save(user);
      }

      // Mise à jour des informations utilisateur
      if (step1) {
        const genderRepo = queryRunner.manager.getRepository(Gender);
        const gender = step1.gender
          ? await genderRepo.findOne({ where: { code: step1.gender } })
          : null;

        user.email = step1.email?.toLowerCase() ?? user.email;
        user.firstName = step1.firstName
          ? capitalizeFirstLetter(step1.firstName)
          : user.firstName;
        user.lastName = step1.lastName
          ? capitalizeFirstLetter(step1.lastName)
          : user.lastName;
        user.birthDate = step1.birthDate
          ? new Date(step1.birthDate)
          : user.birthDate;
        user.genderId = gender?.id ?? user.genderId;
        user.phoneNumber = step1.phone ?? user.phoneNumber;
        user.isRefugee = step1.status
          ? step1.status === 'refugie'
          : user.isRefugee;
        // existingUser.updatedByIp = ip;
      }

      // Mise à jour de la catégorie du bénéficiaire
      if (step1?.status) {
        existingBeneficiary.category =
          step1.status === 'refugie' ? 'REFUGEE' : 'BURUNDIAN';
      }

      const savedUser = await queryRunner.manager.save(user);

      // Mise à jour de l'entreprise
      if (step2) {
        const beneficiary = existingBeneficiary;

        if (step2.companyExists === 'yes') {
          const companyRepo = queryRunner.manager.getRepository(Company);

          if (beneficiary?.company) {
            // Mise à jour de l'entreprise existante
            beneficiary.company.companyName =
              step2.companyName ?? beneficiary.company.companyName;
            beneficiary.company.taxIdNumber =
              step2.nif ?? beneficiary.company.taxIdNumber;
            beneficiary.company.creationDate = step2.creationYear
              ? new Date(`${step2.creationYear}-01-01`)
              : beneficiary.company.creationDate;
            beneficiary.company.primarySectorId =
              step2.sectorId ?? beneficiary.company.primarySectorId;
            beneficiary.company.activityDescription =
              step2.activityDescription ??
              beneficiary.company.activityDescription;
            beneficiary.company.permanentEmployees =
              step2.employeeCount ?? beneficiary.company.permanentEmployees;
            beneficiary.company.isLedByWoman =
              step2.isWomanLed ?? beneficiary.company.isLedByWoman;
            beneficiary.company.isLedByRefugee =
              step2.isRefugeeLed ?? beneficiary.company.isLedByRefugee;
            beneficiary.company.hasPositiveClimateImpact =
              step2.hasClimateImpact ??
              beneficiary.company.hasPositiveClimateImpact;
            beneficiary.company.revenueYearN1 =
              step2.annualRevenue ?? beneficiary.company.revenueYearN1;

            await queryRunner.manager.save(beneficiary.company);
          } else if (beneficiary) {
            this.logger.log(
              `Creating company for beneficiary ${beneficiary.id}...`,
            );
            // Création d'une nouvelle entreprise
            const company = companyRepo.create({
              companyName: step2.companyName,
              taxIdNumber: step2.nif,
              creationDate: step2.creationYear
                ? new Date(`${step2.creationYear}-01-01`)
                : null,
              primarySectorId: step2.sectorId,
              activityDescription: step2.activityDescription,
              permanentEmployees: step2.employeeCount || 0,
              isLedByWoman: step2.isWomanLed || false,
              isLedByRefugee: step2.isRefugeeLed || false,
              hasPositiveClimateImpact: step2.hasClimateImpact || false,
              revenueYearN1: step2.annualRevenue || 0,
              headquartersAddressId: savedUser.primaryAddressId,
              statusId: await this.getStatusId(
                'PENDING_VALIDATION',
                'COMPANY',
                queryRunner,
              ),
              companyType:
                step2.companyStatus && step2.companyStatus !== 'project'
                  ? step2.companyStatus
                  : null,
            });
            const savedCompany = await queryRunner.manager.save(company);
            beneficiary.companyId = savedCompany.id;
            await queryRunner.manager.save(beneficiary);
          }
        } else if (step2.companyExists === 'no' && beneficiary?.company) {
          // Supprimer l'entreprise si l'utilisateur n'en a plus
          beneficiary.companyId = null;
          // await queryRunner.manager.remove(beneficiary.company);
        }

        if (step2?.companyStatus) {
          beneficiary.companyType = step2.companyStatus;
        }

        await queryRunner.manager.save(beneficiary);
      }

      // Mise à jour des consentements
      if (step3) {
        // Supprimer les anciens consentements
        await queryRunner.manager.delete(UserConsent, { userId: savedUser.id });

        // Créer les nouveaux consentements
        await this.saveUserConsents(
          queryRunner,
          savedUser.id,
          step3,
          ip,
          userAgent,
        );

        // Mise à jour de la date d'acceptation des CGU
        if (step3.acceptCGU) {
          savedUser.cguAcceptedAt = new Date();
          await queryRunner.manager.save(savedUser);
        }
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Journalisation
      this.logger.log(`Beneficiary ${beneficiaryId} updated successfully`);

      const percentage =
        await this.profileCompletionService.calculateAndUpdateCompletion(
          parseInt(beneficiaryId),
        );

      // Retourner le résultat
      return {
        success: true,
        message: 'Mise à jour réussie !',
        userId: savedUser.id,
        beneficiaryId: savedUser.beneficiary?.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        profileCompletion: percentage,
      };
    } catch (error) {
      console.log('Erreur complète:', {
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        message: error.message,
      });
      // Rollback en cas d'erreur
      await queryRunner.rollbackTransaction();
      this.logger.error(`Update failed for beneficiary ${beneficiaryId}:`, {
        error: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack,
      });

      if (error.code === '23505') {
        throw new ConflictException('Une erreur de duplication est survenue');
      }

      throw new InternalServerErrorException(
        'Erreur lors de la mise à jour. Veuillez réessayer.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // Méthodes de validation supplémentaires
  private async validateStep1ForUpdate(step1: any, userId: string) {
    // if (step1.email) {
    //   const existingUser = await this.userRepo.findOne({
    //     where: { email: step1.email.toLowerCase() },
    //   });
    //   if (existingUser && existingUser.id !== parseInt(userId)) {
    //     throw new ConflictException('Cet email est déjà utilisé');
    //   }
    // }
    // Autres validations spécifiques à la mise à jour
  }

  private validateStep2ForUpdate(step2: any) {
    // Validations spécifiques pour la mise à jour de l'entreprise
    if (step2.companyExists === 'yes') {
      if (!step2.companyName) {
        throw new BadRequestException("Le nom de l'entreprise est requis");
      }
      // Autres validations...
    }
  }

  private validateStep3(dto: UpdateStep3Dto): void {
    if (!dto.acceptCGU || !dto.acceptPrivacyPolicy || !dto.certifyAccuracy) {
      throw new BadRequestException(
        "Vous devez accepter les conditions générales, la politique de confidentialité et certifier l'exactitude des informations",
      );
    }
  }

  private async getStatusId(
    code: string,
    entityType: string,
    queryRunner: any,
  ): Promise<number | null> {
    const statusRepo = queryRunner.manager.getRepository(Status);
    const status = await statusRepo.findOne({
      where: { code, entityType },
    });
    return status?.id || null;
  }

  private async saveUserConsents(
    queryRunner: any,
    userId: number,
    step3: any,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    const consentTypeRepo = queryRunner.manager.getRepository(ConsentType);
    const consentTypes = await consentTypeRepo.find();

    for (const consentType of consentTypes) {
      let value = false;
      if (consentType.code === 'TERMS_AND_CONDITIONS') value = step3.acceptCGU;
      if (consentType.code === 'PRIVACY_POLICY')
        value = step3.acceptPrivacyPolicy;
      if (consentType.code === 'CERTIFY_ACCURACY')
        value = step3.certifyAccuracy;
      if (consentType.code === 'COMMUNICATIONS')
        value = step3.optInNotifications || false;

      // Ne créer que si le consentement a une valeur true
      if (value) {
        const userConsentRepo = queryRunner.manager.getRepository(UserConsent);
        const userConsent = userConsentRepo.create({
          userId: userId,
          consentTypeId: consentType.id,
          value: value,
          ipAddress: ip,
          userAgent: userAgent || 'unknown',
          givenAt: new Date(),
        });
        await queryRunner.manager.save(userConsent);
      }
    }
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
