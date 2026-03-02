import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { UsersService } from '../users/users.service';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegistrationStep1Dto } from './dto/register-step1.dto';
import { RegistrationStep2Dto } from './dto/register-step2.dto';
import { RegistrationStep3Dto } from './dto/register-step3.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Address } from '../reference/entities/address.entity';
import { Status } from '../reference/entities/status.entity';
import { NotificationsService } from '../notifications/notifications.service';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { UserConsent } from '../users/entities/user-consent.entity';
import { ConsentType } from '../reference/entities/consent-type.entity';
import { Role } from '../reference/entities/role.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { Gender } from '../reference/entities/gender.entity';
import { RegistrationMpmeDto } from './dto/register-mpme.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Registration Service');
  private readonly TTL = 3600;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    private dataSource: DataSource,
  ) {}

  async validateUser(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Journaliser la tentative échouée (utilisateur inexistant)
      await this.authRepository.logLoginAttempt(
        null,
        email,
        false,
        ipAddress,
        userAgent,
        'User not found',
      );
      throw new UnauthorizedException('Nom d\'utilisateur ou mot de passe incorrect');
    }

    if (user.isBlocked) {
      await this.authRepository.logLoginAttempt(
        user.id,
        email,
        false,
        ipAddress,
        userAgent,
        'Account is blocked',
      );
      throw new UnauthorizedException('Ce compte est bloqué');
    }

    if (!user.isActive) {
      await this.authRepository.logLoginAttempt(
        user.id,
        email,
        false,
        ipAddress,
        userAgent,
        'Account is inactive',
      );
      throw new UnauthorizedException('Ce compte est inactif');
    }

    if (!user.isVerified) {
      await this.authRepository.logLoginAttempt(
        user.id,
        email,
        false,
        ipAddress,
        userAgent,
        'Account is not verified',
      );
      throw new UnauthorizedException(
        'Compte non vérifié. Veuillez vérifier votre email pour activer votre compte',
      );
    }

    // Vérifier le nombre de tentatives échouées récentes
    const failedAttempts = await this.authRepository.getFailedLoginAttempts(
      email,
      30,
    );
    if (failedAttempts >= 5) {
      if (user) {
        await this.usersService.toggleUserBlock(user.id, true);
      }
      await this.authRepository.logLoginAttempt(
        user?.id || null,
        email,
        false,
        ipAddress,
        userAgent,
        'Account blocked due to too many failed attempts',
      );
      throw new UnauthorizedException(
        'Votre compte a été bloqué suite à trop de tentatives de connexion échouées. Veuillez contacter le support.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Track failed login attempt
      await this.usersService.recordFailedLogin(user.id);
      await this.authRepository.logLoginAttempt(
        user.id,
        email,
        false,
        ipAddress,
        userAgent,
        'Invalid password',
      );
      throw new UnauthorizedException(
        "Nom d\'utilisateur ou mot de passe incorrect",
      );
    }

    // Reset failed login attempts on successful login
    await this.usersService.resetFailedLoginAttempts(user.id);

    // Journaliser la tentative réussie
    await this.authRepository.logLoginAttempt(
      user.id,
      email,
      true,
      ipAddress,
      userAgent,
    );

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any, ipAddress: string, userAgent: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
    };
  }

  async registerMpme(
    registerDto: RegistrationMpmeDto,
    ip: string,
    userAgent: string,
  ) {
    // Validate registration
    await this.validateMpme(registerDto);

    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      // Create user
      const userRepo = queryRunner.manager.getRepository(User);

      const user = userRepo.create({
        email: registerDto.email.toLowerCase(),
        passwordHash: hashedPassword,
        firstName: this.capitalizeFirstLetter(registerDto.firstName),
        lastName: this.capitalizeFirstLetter(registerDto.lastName),
        phoneNumber: registerDto.phone,
        cguAcceptedAt: registerDto.acceptCGU ? new Date() : null,
        createdByIp: ip,
        isActive: true,
        isVerified: false,
        failedLoginAttempts: 0,
        isBlocked: false,
      });
      const savedUser = await queryRunner.manager.save(user);

      // Create beneficiary status
      const statusRepo = queryRunner.manager.getRepository(Status);
      let registeredStatus = await statusRepo.findOne({
        where: { code: 'REGISTERED', entityType: 'BENEFICIARY' },
      });

      if (!registeredStatus) {
        registeredStatus = statusRepo.create({
          code: 'REGISTERED',
          name: 'Registered',
          entityType: 'BENEFICIARY',
          displayOrder: 1,
          isActive: true,
        });
        registeredStatus = await queryRunner.manager.save(registeredStatus);
      }

      // Create beneficiary
      const beneficiaryRepo = queryRunner.manager.getRepository(Beneficiary);
      const beneficiary = beneficiaryRepo.create({
        userId: savedUser.id,
        companyId: null,
        statusId: registeredStatus.id,
        category: 'BURUNDIAN',
      });
      const savedBeneficiary = await queryRunner.manager.save(beneficiary);

      // Create user consents
      await this.saveUserConsents(
        queryRunner,
        savedUser.id,
        registerDto,
        ip,
        userAgent,
      );

      // Assign beneficiary role
      await this.assignBeneficiaryRole(queryRunner, savedUser.id);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Send notifications
      try {
        await this.createEmailVerification(savedUser);

        // SMS confirmation if phone number is provided
        //       if (savedUser.phoneNumber) {
        //   await this.notificationsService.sendSms({
        //     to: savedUser.phoneNumber,
        //     message: `COPA: Bienvenue ${savedUser.firstName}! Votre inscription est réussie. Votre dossier sera validé sous 48h. Connectez-vous sur ${this.configService.get('APP_FRONTEND_URL')}`,
        //   });
        // }

        this.logger.log(`Notifications sent to user ${savedUser.id}`);
      } catch (notifError) {
        // Log error
        this.logger.error(
          `Failed to send notifications to user ${savedUser.id}:`,
          notifError,
        );
      }

      // Return result
      return {
        success: true,
        message:
          'Inscription réussie ! Votre compte est en attente de validation.',
        userId: savedUser.id,
        beneficiaryId: savedBeneficiary.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        requiresEmailVerification: false,
        requiresDocumentUpload: true,
        nextSteps: [
          'Un email de confirmation vous a été envoyé',
          'Un SMS de bienvenue a été envoyé sur votre téléphone',
          'Votre dossier sera validé sous 24-48h',
          'Vous recevrez une notification dès validation',
          'Complétez votre profil et téléchargez vos documents',
        ],
      };
    } catch (error) {
      // Rollback en cas d'erreur
      await queryRunner.rollbackTransaction();
      this.logger.error('Registration failed:', error);

      // if (error.code === '23505') {
      //   // Duplicate key error
      //   throw new ConflictException('Une erreur de duplication est survenue');
      // }

      throw new InternalServerErrorException(
        "Erreur lors de l'inscription. Veuillez réessayer.",
      );
    } finally {
      await queryRunner.release();
    }
  }

  async register(registerDto: RegisterDto, ip: string, userAgent: string) {
    const { step1, step2, step3 } = registerDto;

    // Validate registration steps
    await this.validateStep1(step1);
    await this.validateStep2(step2);
    this.validateStep3(step3);

    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(step1.password, 10);

      // Create address
      const addressRepo = queryRunner.manager.getRepository(Address);
      const address = addressRepo.create({
        provinceId: step1.provinceId,
        communeId: step1.communeId,
      });
      const savedAddress = await queryRunner.manager.save(address);

      // Create user
      const userRepo = queryRunner.manager.getRepository(User);
      const genderRepo = queryRunner.manager.getRepository(Gender);
      const gender = await genderRepo.findOne({
        where: { code: step1.gender },
      });

      const user = userRepo.create({
        email: step1.email.toLowerCase(),
        passwordHash: hashedPassword,
        firstName: this.capitalizeFirstLetter(step1.firstName),
        lastName: this.capitalizeFirstLetter(step1.lastName),
        birthDate: new Date(step1.birthDate),
        genderId: gender?.id || null,
        phoneNumber: step1.phone,
        isRefugee: step1.status === 'refugie',
        primaryAddressId: savedAddress.id,
        cguAcceptedAt: step3.acceptCGU ? new Date() : null,
        createdByIp: ip,
        isActive: true,
        isVerified: false,
        failedLoginAttempts: 0,
        isBlocked: false,
      });
      const savedUser = await queryRunner.manager.save(user);

      // Create company if it exists
      let savedCompany: Company | null = null;
      if (step2.companyExists === 'yes') {
        const companyRepo = queryRunner.manager.getRepository(Company);
        const company = companyRepo.create({
          companyName: step2.companyName,
          taxIdNumber: step2.nif,
          creationDate: step2.creationYear
            ? new Date(`${step2.creationYear}-01-01`)
            : null,
          primarySectorId: step2.sectorId,
          activityDescription: step2.description,
          permanentEmployees: step2.employeeCount || 0,
          isLedByWoman: step2.isWomanLed || false,
          isLedByRefugee: step2.isRefugeeLed || false,
          hasPositiveClimateImpact: step2.hasClimateImpact || false,
          revenueYearN1: step2.annualRevenue || 0,
          headquartersAddressId: savedAddress.id,
          statusId: await this.getStatusId(
            'PENDING_VALIDATION',
            'COMPANY',
            queryRunner,
          ),
        });
        savedCompany = await queryRunner.manager.save(company);
      }

      // Create beneficiary status
      const statusRepo = queryRunner.manager.getRepository(Status);
      let registeredStatus = await statusRepo.findOne({
        where: { code: 'REGISTERED', entityType: 'BENEFICIARY' },
      });

      if (!registeredStatus) {
        registeredStatus = statusRepo.create({
          code: 'REGISTERED',
          name: 'Registered',
          entityType: 'BENEFICIARY',
          displayOrder: 1,
          isActive: true,
        });
        registeredStatus = await queryRunner.manager.save(registeredStatus);
      }

      // Create beneficiary
      const beneficiaryRepo = queryRunner.manager.getRepository(Beneficiary);
      const beneficiary = beneficiaryRepo.create({
        userId: savedUser.id,
        companyId: savedCompany?.id || null,
        statusId: registeredStatus.id,
        category: step1.status === 'refugie' ? 'REFUGEE' : 'BURUNDIAN',
      });
      const savedBeneficiary = await queryRunner.manager.save(beneficiary);

      // Create user consents
      await this.saveUserConsents(
        queryRunner,
        savedUser.id,
        step3,
        ip,
        userAgent,
      );

      // Assign beneficiary role
      await this.assignBeneficiaryRole(queryRunner, savedUser.id);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Send notifications
      try {
        // Email confirmation
        // await this.notificationsService.sendWelcomeEmail({
        //   to: savedUser.email,
        //   template: 'welcome',
        //   data: {
        //     firstName: savedUser.firstName,
        //     loginUrl: `${this.configService.get('APP_FRONTEND_URL')}/login`,
        //   },
        // });
        this.createEmailVerification(savedUser);

        // SMS confirmation if phone number is provided
        //       if (savedUser.phoneNumber) {
        //   await this.notificationsService.sendSms({
        //     to: savedUser.phoneNumber,
        //     message: `COPA: Bienvenue ${savedUser.firstName}! Votre inscription est réussie. Votre dossier sera validé sous 48h. Connectez-vous sur ${this.configService.get('APP_FRONTEND_URL')}`,
        //   });
        // }

        this.logger.log(`Notifications sent to user ${savedUser.id}`);
      } catch (notifError) {
        // Log error
        this.logger.error(
          `Failed to send notifications to user ${savedUser.id}:`,
          notifError,
        );
      }

      // Return result
      return {
        success: true,
        message:
          'Inscription réussie ! Votre compte est en attente de validation.',
        userId: savedUser.id,
        beneficiaryId: savedBeneficiary.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        requiresEmailVerification: false,
        requiresDocumentUpload: true,
        nextSteps: [
          'Un email de confirmation vous a été envoyé',
          'Un SMS de bienvenue a été envoyé sur votre téléphone',
          'Votre dossier sera validé sous 24-48h',
          'Vous recevrez une notification dès validation',
          'Complétez votre profil et téléchargez vos documents',
        ],
      };
    } catch (error) {
      // Rollback en cas d'erreur
      await queryRunner.rollbackTransaction();
      this.logger.error('Registration failed:', error);

      // if (error.code === '23505') {
      //   // Duplicate key error
      //   throw new ConflictException('Une erreur de duplication est survenue');
      // }

      throw new InternalServerErrorException(
        "Erreur lors de l'inscription. Veuillez réessayer.",
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crée un token de vérification et envoie l'email
   */
  async createEmailVerification(user: User): Promise<void> {
    try {
      // Générer un nouveau token
      const verificationToken = this.generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // Valable 48h

      // Sauvegarder le token directement dans l'entité User
      user.verificationToken = verificationToken;
      user.verificationTokenExpiresAt = expiresAt;
      await this.userRepo.save(user);

      // Construire le lien d'activation
      const frontendUrl =
        this.configService.get('APP_FRONTEND_URL') || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

      // Envoyer l'email via votre service de notifications
      await this.notificationsService.sendWelcomeEmail({
        to: user.email,
        template: 'welcome',
        data: {
          firstName: user.firstName,
          loginUrl: `${frontendUrl}/login`,
          activationLink,
          verificationToken,
        },
      });

      this.logger.log(`Email de vérification envoyé à ${user.email}`);
    } catch (error) {
      this.logger.error(`Erreur création vérification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie l'email avec le token
   */
  async verifyEmail(email: string, token: string): Promise<boolean> {
    // Trouver l'utilisateur
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Si déjà vérifié, retourner vrai
    if (user.isVerified) {
      return true;
    }

    // Vérifier si le token correspond
    if (user.verificationToken !== token) {
      throw new BadRequestException(
        'Votre lien de vérification est expiré, veuillez en demander un nouveau.',
      );
    }

    // Vérifier si le token a expiré
    if (
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Token de vérification expiré');
    }

    // Marquer l'utilisateur comme vérifié
    user.isVerified = true;
    user.verificationToken = null; // Effacer le token
    user.verificationTokenExpiresAt = null;

    await this.userRepo.save(user);

    this.logger.log(`Email ${email} vérifié avec succès`);

    return true;
  }

  /**
   * Renvoie un email de vérification
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.isVerified) {
      throw new BadRequestException('Cet email est déjà vérifié');
    }

    // Créer et envoyer un nouveau token
    await this.createEmailVerification(user);
  }

  /**
   * Nettoie les tokens expirés (cron job)
   */
  async cleanExpiredVerificationTokens(): Promise<number> {
    const result = await this.userRepo.update(
      {
        verificationTokenExpiresAt: LessThan(new Date()),
      },
      {
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`${result.affected} tokens expirés nettoyés`);
    }

    return result.affected || 0;
  }

  /**
   * Génère un token de vérification aléatoire
   */
  private generateVerificationToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  async createRefreshToken(userId: number): Promise<string> {
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        parseInt(
          this.configService.get('app.jwt.refreshExpiresIn').replace('d', ''),
        ),
    );

    const token = new RefreshToken();
    token.userId = userId;
    token.token = refreshToken;
    token.expiresAt = expiresAt;

    await this.authRepository.saveRefreshToken(token);

    return refreshToken;
  }

  async refreshToken(refreshToken: string) {
    const token = await this.authRepository.findValidRefreshToken(refreshToken);

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(token.userId);

    if (!user || !user.isActive || user.isBlocked) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Revoke old refresh token
    await this.authRepository.revokeRefreshToken(token.id);

    // Generate new tokens
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: number, refreshToken: string): Promise<void> {
    const token = await this.authRepository.findRefreshToken(refreshToken);

    if (token && token.userId === userId) {
      await this.authRepository.revokeRefreshToken(token.id);
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Return success even if user not found for security
      return { message: 'If your email exists, you will receive a reset link' };
    }

    const resetToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    await this.usersService.setResetToken(user.id, resetToken, expiresAt);

    // TODO: Send email with reset link
    // await this.notificationsService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If your email exists, you will receive a reset link' };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const saltRounds = this.configService.get('app.bcryptSaltRounds');
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.usersService.updatePassword(user.id, passwordHash);
    await this.usersService.clearResetToken(user.id);

    return { message: 'Password successfully reset' };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId, [
      'roles',
      'beneficiary',
    ]);
    const { passwordHash, ...result } = user;
    return result;
  }

  async getUserLoginStats(userId: number): Promise<any> {
    const totalAttempts = await this.authRepository[
      'loginAttemptRepository'
    ].count({
      where: { userId },
    });

    const successfulAttempts = await this.authRepository[
      'loginAttemptRepository'
    ].count({
      where: { userId, wasSuccessful: true },
    });

    const failedAttempts = await this.authRepository[
      'loginAttemptRepository'
    ].count({
      where: { userId, wasSuccessful: false },
    });

    const lastLogin = await this.authRepository.getLastSuccessfulLogin(userId);

    const recentFailedAttempts =
      await this.authRepository.getFailedLoginAttempts(
        (await this.usersService.findById(userId)).email,
      );

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate:
        totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
      lastLoginAt: lastLogin?.createdAt || null,
      lastLoginIp: lastLogin?.ipAddress || null,
      recentFailedAttempts,
    };
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

  private async validateMpme(dto: RegistrationMpmeDto): Promise<void> {
    // Vérifier email unique (case-insensitive)
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier téléphone unique
    const existingPhone = await this.userRepo.findOne({
      where: { phoneNumber: dto.phone },
    });

    if (existingPhone) {
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    }

    // Vérifier mot de passe
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }

    // Vérifier CGU, politique de confidentialité et exactitude
    if (!dto.acceptCGU || !dto.acceptPrivacyPolicy || !dto.certifyAccuracy) {
      throw new BadRequestException(
        "Vous devez accepter les conditions générales, la politique de confidentialité et certifier l'exactitude des informations",
      );
    }
  }

  private async validateStep1(dto: RegistrationStep1Dto): Promise<void> {
    // Vérifier email unique (case-insensitive)
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier téléphone unique
    const existingPhone = await this.userRepo.findOne({
      where: { phoneNumber: dto.phone },
    });

    if (existingPhone) {
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    }

    // Vérifier mot de passe
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }

    // Vérifier la force du mot de passe (déjà fait par le DTO)
    // Vérifier l'âge minimum (18 ans)
    const birthDate = new Date(dto.birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 18) {
      throw new BadRequestException('Vous devez avoir au moins 18 ans');
    }
  }

  private async validateStep2(dto: RegistrationStep2Dto): Promise<void> {
    if (dto.companyExists === 'yes') {
      // Vérifier que tous les champs obligatoires sont présents
      if (!dto.companyName || !dto.nif || !dto.creationYear || !dto.sectorId) {
        throw new BadRequestException(
          'Tous les champs entreprise sont obligatoires',
        );
      }

      // Vérifier NIF unique
      if (dto.nif) {
        const existingNif = await this.companyRepo.findOne({
          where: { taxIdNumber: dto.nif },
        });

        if (existingNif) {
          throw new ConflictException('Ce NIF est déjà enregistré');
        }
      }

      // Vérifier que l'année de création n'est pas dans le futur
      if (dto.creationYear > new Date().getFullYear()) {
        throw new BadRequestException(
          "L'année de création ne peut pas être dans le futur",
        );
      }
    }
  }

  private validateStep3(dto: RegistrationStep3Dto): void {
    if (!dto.acceptCGU || !dto.acceptPrivacyPolicy || !dto.certifyAccuracy) {
      throw new BadRequestException(
        "Vous devez accepter les conditions générales, la politique de confidentialité et certifier l'exactitude des informations",
      );
    }
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

  private async assignBeneficiaryRole(
    queryRunner: any,
    userId: number,
  ): Promise<void> {
    const roleRepo = queryRunner.manager.getRepository(Role);
    let beneficiaryRole = await roleRepo.findOne({
      where: { code: 'BENEFICIARY' },
    });

    if (!beneficiaryRole) {
      beneficiaryRole = roleRepo.create({
        code: 'BENEFICIARY',
        name: 'Beneficiary',
        description: 'MPME beneficiary',
        level: 10,
        isInternal: false,
        isActive: true,
      });
      beneficiaryRole = await queryRunner.manager.save(beneficiaryRole);
    }

    const userRoleRepo = queryRunner.manager.getRepository(UserRole);
    const userRole = userRoleRepo.create({
      userId: userId,
      roleId: beneficiaryRole.id,
      isActive: true,
      startDate: new Date(),
    });
    await queryRunner.manager.save(userRole);
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}
