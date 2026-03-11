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
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannel,
  NotificationType,
} from '../notifications/dto/create-notification.dto';
import { Document } from '../documents/entities/document.entity';

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
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
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
        'company.address',
        'company.status',
        'company.legalForm',
        'company.primarySector',
        'company.secondarySector',
        'status',
      ],
    });

    if (!beneficiary) {
      throw new NotFoundException(
        `Beneficiary for user ID ${userId} not found`,
      );
    }

    const documents = await this.documentRepository.find({
      where: {
        entityId: beneficiary.id,
        entityType: 'beneficiary',
      },
      relations: ['documentType', 'uploadedBy'],
      order: { createdAt: 'DESC' },
    });

    const percentage =
      await this.profileCompletionService.calculateAndUpdateCompletion(
        beneficiary.id,
      );

    const documentsByKey = documents.reduce((acc, doc) => {
      if (doc.documentKey) {
        // Garder seulement le dernier document pour chaque type
        acc[doc.documentKey] = doc;
      }
      return acc;
    }, {});

    return {
      ...beneficiary,
      profileCompletion: percentage,
      documents: documents,
      documentsByKey: documentsByKey,
    };
  }

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
          user.primaryAddress.neighborhood =
            step1.neighborhood ?? user.primaryAddress.neighborhood;
          user.primaryAddress.street = step1.zone ?? user.primaryAddress.street;
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

      // Mise à jour de la fonction du bénéficiaire dans l'entreprise
      if (step1?.position) {
        existingBeneficiary.position =
          step1.position || existingBeneficiary.position;
      }

      // Mise à jour des Questions d'éligibilité du bénéficiaire
      if (step1) {
        existingBeneficiary.maritalStatus = step1.maritalStatus;
        existingBeneficiary.educationLevel = step1.educationLevel;
        existingBeneficiary.isPublicServant = step1.isPublicServant;
        existingBeneficiary.isRelativeOfPublicServant =
          step1.isRelativeOfPublicServant;
        existingBeneficiary.isPublicIntern = step1.isPublicIntern;
        existingBeneficiary.isRelativeOfPublicIntern =
          step1.isRelativeOfPublicIntern;
        existingBeneficiary.wasHighOfficer = step1.wasHighOfficer;
        existingBeneficiary.isRelativeOfHighOfficer =
          step1.isRelativeOfHighOfficer;
        existingBeneficiary.hasProjectLink = step1.hasProjectLink;
        existingBeneficiary.isDirectSupplierToProject =
          step1.isDirectSupplierToProject;
        existingBeneficiary.hasPreviousGrant = step1.hasPreviousGrant;
        existingBeneficiary.previousGrantDetails = step1.previousGrantDetails;
      }

      const savedUser = await queryRunner.manager.save(user);
      await queryRunner.manager.save(existingBeneficiary);

      // Mise à jour de l'entreprise
      if (step2) {
        const beneficiary = existingBeneficiary;

        if (step2.companyExists === 'yes') {
          const companyRepo = queryRunner.manager.getRepository(Company);
          const addressRepo = queryRunner.manager.getRepository(Address);

          // Gestion de l'adresse de l'entreprise
          let companyAddressId = null;
          if (
            step2.companyProvinceId ||
            step2.companyCommuneId ||
            step2.companyNeighborhood ||
            step2.companyZone
          ) {
            const address = addressRepo.create({
              provinceId: step2.companyProvinceId,
              communeId: step2.companyCommuneId,
              neighborhood: step2.companyNeighborhood,
              street: step2.companyZone,
            });
            const savedAddress = await queryRunner.manager.save(address);
            companyAddressId = savedAddress.id as any;
          }

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
            beneficiary.company.companyType =
              step2.companyStatus ?? beneficiary.company.companyType;

            beneficiary.company.legalStatus =
              step2.legalStatus ?? beneficiary.company.legalStatus;
            beneficiary.company.legalStatusOther =
              step2.legalStatusOther ?? beneficiary.company.legalStatusOther;
            beneficiary.company.affiliatedToCGA =
              step2.affiliatedToCGA ?? beneficiary.company.affiliatedToCGA;
            beneficiary.company.femaleEmployees =
              step2.femaleEmployees ?? beneficiary.company.femaleEmployees;
            beneficiary.company.maleEmployees =
              step2.maleEmployees ?? beneficiary.company.maleEmployees;
            beneficiary.company.refugeeEmployees =
              step2.refugeeEmployees ?? beneficiary.company.refugeeEmployees;
            beneficiary.company.batwaEmployees =
              step2.batwaEmployees ?? beneficiary.company.batwaEmployees;
            beneficiary.company.disabledEmployees =
              step2.disabledEmployees ?? beneficiary.company.disabledEmployees;
            beneficiary.company.associatesCount =
              step2.associatesCount ?? beneficiary.company.associatesCount;
            beneficiary.company.associatesCountOther =
              step2.associatesCountOther ??
              beneficiary.company.associatesCountOther;
            beneficiary.company.femalePartners =
              step2.femalePartners ?? beneficiary.company.femalePartners;
            beneficiary.company.malePartners =
              step2.malePartners ?? beneficiary.company.malePartners;
            beneficiary.company.refugeePartners =
              step2.refugeePartners ?? beneficiary.company.refugeePartners;
            beneficiary.company.batwaPartners =
              step2.batwaPartners ?? beneficiary.company.batwaPartners;
            beneficiary.company.disabledPartners =
              step2.disabledPartners ?? beneficiary.company.disabledPartners;
            beneficiary.company.hasBankAccount =
              step2.hasBankAccount ?? beneficiary.company.hasBankAccount;
            beneficiary.company.hasBankCredit =
              step2.hasBankCredit ?? beneficiary.company.hasBankCredit;
            beneficiary.company.bankCreditAmount =
              step2.bankCreditAmount ?? beneficiary.company.bankCreditAmount;
            beneficiary.company.companyPhone =
              step2.companyPhone ?? beneficiary.company.companyPhone;
            beneficiary.company.companyEmail =
              step2.companyEmail ?? beneficiary.company.companyEmail;

            if (companyAddressId) {
              beneficiary.company.addressId = companyAddressId;
            }

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
              companyType: step2.companyStatus,
              addressId: companyAddressId,
              statusId: await this.getStatusId(
                'PENDING_VALIDATION',
                'COMPANY',
                queryRunner,
              ),

              // Nouveaux champs
              legalStatus: step2.legalStatus,
              legalStatusOther: step2.legalStatusOther,
              affiliatedToCGA: step2.affiliatedToCGA,
              femaleEmployees: step2.femaleEmployees || 0,
              maleEmployees: step2.maleEmployees || 0,
              refugeeEmployees: step2.refugeeEmployees || 0,
              batwaEmployees: step2.batwaEmployees || 0,
              disabledEmployees: step2.disabledEmployees || 0,
              associatesCount: step2.associatesCount,
              associatesCountOther: step2.associatesCountOther,
              femalePartners: step2.femalePartners || 0,
              malePartners: step2.malePartners || 0,
              refugeePartners: step2.refugeePartners || 0,
              batwaPartners: step2.batwaPartners || 0,
              disabledPartners: step2.disabledPartners || 0,
              hasBankAccount: step2.hasBankAccount,
              hasBankCredit: step2.hasBankCredit,
              bankCreditAmount: step2.bankCreditAmount,
              companyPhone: step2.companyPhone,
              companyEmail: step2.companyEmail,
            } as any);
            const savedCompany: any = await queryRunner.manager.save(company);
            beneficiary.companyId = savedCompany.id;
            // await queryRunner.manager.save(beneficiary);
          }
        } else if (step2.companyExists === 'no' && beneficiary?.company) {
          // Supprimer l'entreprise si l'utilisateur n'en a plus
          beneficiary.companyId = null;
          // await queryRunner.manager.remove(beneficiary.company);
        }

        if (step2?.companyStatus) {
          beneficiary.companyType = step2.companyStatus;
        }

        if (step3?.isProfileCompleted) {
          beneficiary.isProfileComplete = step3.isProfileCompleted;

          const nextNumber = beneficiary.id;
          // Limiter à 99999 maximum
          if (nextNumber > 99999) {
            throw new Error(
              'Limite de numéros de bénéficiaires atteinte (99999)'
            );
          }

          // Formater sur 5 chiffres avec des zéros devant
          beneficiary.applicationCode = nextNumber.toString().padStart(5, '0');
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

        // Mise à jour des champs projet dans beneficiary
        existingBeneficiary.projectTitle =
          step3.projectTitle ?? existingBeneficiary.projectTitle;
        existingBeneficiary.projectObjective =
          step3.projectObjective ?? existingBeneficiary.projectObjective;
        existingBeneficiary.projectSectors =
          step3.projectSectors ?? existingBeneficiary.projectSectors;
        existingBeneficiary.otherSector =
          step3.otherSector ?? existingBeneficiary.otherSector;
        existingBeneficiary.mainActivities =
          step3.mainActivities ?? existingBeneficiary.mainActivities;
        existingBeneficiary.productsServices =
          step3.productsServices ?? existingBeneficiary.productsServices;
        existingBeneficiary.businessIdea =
          step3.businessIdea ?? existingBeneficiary.businessIdea;
        existingBeneficiary.targetClients =
          step3.targetClients ?? existingBeneficiary.targetClients;
        existingBeneficiary.clientScope =
          step3.clientScope ?? existingBeneficiary.clientScope;
        existingBeneficiary.hasCompetitors =
          step3.hasCompetitors ?? existingBeneficiary.hasCompetitors;
        existingBeneficiary.competitorNames =
          step3.competitorNames ?? existingBeneficiary.competitorNames;
        existingBeneficiary.plannedEmployeesFemale =
          step3.plannedEmployeesFemale ??
          existingBeneficiary.plannedEmployeesFemale;
        existingBeneficiary.plannedEmployeesMale =
          step3.plannedEmployeesMale ??
          existingBeneficiary.plannedEmployeesMale;
        existingBeneficiary.plannedPermanentEmployees =
          step3.plannedPermanentEmployees ??
          existingBeneficiary.plannedPermanentEmployees;
        existingBeneficiary.isNewIdea =
          step3.isNewIdea ?? existingBeneficiary.isNewIdea;
        existingBeneficiary.climateActions =
          step3.climateActions ?? existingBeneficiary.climateActions;
        existingBeneficiary.inclusionActions =
          step3.inclusionActions ?? existingBeneficiary.inclusionActions;
        existingBeneficiary.hasEstimatedCost =
          step3.hasEstimatedCost ?? existingBeneficiary.hasEstimatedCost;
        existingBeneficiary.totalProjectCost =
          step3.totalProjectCost ?? existingBeneficiary.totalProjectCost;
        existingBeneficiary.requestedSubsidyAmount =
          step3.requestedSubsidyAmount ??
          existingBeneficiary.requestedSubsidyAmount;
        existingBeneficiary.mainExpenses =
          step3.mainExpenses ?? existingBeneficiary.mainExpenses;

        await queryRunner.manager.save(existingBeneficiary);
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Journalisation
      this.logger.log(`Beneficiary ${beneficiaryId} updated successfully`);

      const percentage =
        await this.profileCompletionService.calculateAndUpdateCompletion(
          parseInt(beneficiaryId),
        );

      // === ENVOI DE L'EMAIL SI 100% ET QUE C'EST LA PREMIÈRE FOIS ===
      if (step3?.isProfileCompleted) {
        try {
          this.logger.log(
            `🎉 Profil complet à 100% pour ${user.email}. Envoi de l'email de confirmation...`,
          );

          // Récupérer l'utilisateur complet avec toutes ses informations
          const completeUser = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            code: existingBeneficiary.applicationCode,
          };

          // Envoyer l'email de confirmation
          await this.notificationsService.sendConfirmationProfilEnregistre({
            user: completeUser,
            datePreselection: this.getPreselectionDate(),
            dateFormation: this.getFormationDate(),
            dateResultatsPreselection: this.getResultatsDate(),
          });

          this.logger.log(`✅ Email de confirmation envoyé à ${user.email}`);
        } catch (emailError) {
          // Ne pas bloquer la réponse si l'email échoue
          this.logger.error(
            `❌ Erreur envoi email à ${user.email}:`,
            emailError,
          );

          // Optionnel: Sauvegarder l'erreur pour un retry ultérieur
          await this.saveFailedEmailNotification(user.id, emailError);
        }
      }

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

  /**
   * Méthodes utilitaires pour les dates
   */
  private getPreselectionDate(): string {
    // À configurer selon vos besoins (peut venir d'une config ou base de données)
    const year = new Date().getFullYear();
    return `15 - 30 avril ${year}`;
  }

  private getFormationDate(): string {
    const year = new Date().getFullYear();
    return `10 - 25 mai ${year}`;
  }

  private getResultatsDate(): string {
    const year = new Date().getFullYear();
    return `30 avril ${year}`;
  }

  /**
   * Sauvegarde une notification d'email échoué pour retry ultérieur
   */
  private async saveFailedEmailNotification(
    userId: number,
    error: any,
  ): Promise<void> {
    try {
      // Vous pouvez créer une table FailedEmails ou utiliser un système de queue
      await this.notificationsService.create({
        channel: NotificationChannel.EMAIL,
        type: NotificationType.CONFIRMATION,
        title: 'Confirmation profil complet (échec)',
        content: 'Email de confirmation non envoyé - sera retenté',
        recipientId: userId,
        data: {
          error: error.message,
          retryCount: 0,
          status: 'FAILED',
        },
        scheduledAt: new Date(Date.now() + 3600000) as any,
      });
    } catch (saveError) {
      this.logger.error("Impossible de sauvegarder l'échec:", saveError);
    }
  }
}
