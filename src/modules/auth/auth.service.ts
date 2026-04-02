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
import { randomBytes } from 'crypto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
    @InjectRedis() private readonly redis: Redis,
    private dataSource: DataSource,
  ) { }

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
      throw new UnauthorizedException(
        "Nom d'utilisateur ou mot de passe incorrect",
      );
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

  /**
  * Login administrateur - Vérifie les rôles administrateur
  */
  async adminLogin(email: string, password: string, ipAddress: string, userAgent: string) {
    // 1. Valider les identifiants via la méthode existante
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      await this.authRepository.logLoginAttempt(
        null,
        email,
        false,
        ipAddress,
        userAgent,
        'User not found',
      );
      throw new UnauthorizedException('Email ou mot de passe incorrect');
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

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.usersService.recordFailedLogin(user.id);
      await this.authRepository.logLoginAttempt(
        user.id,
        email,
        false,
        ipAddress,
        userAgent,
        'Invalid password',
      );
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 2. Récupérer les rôles de l'utilisateur
    const userRoles = await this.getUserRoles(user.id);
    const hasAdminRole = userRoles.some(role =>
      ['SUPER_ADMIN', 'ADMIN', 'COPA_MANAGER'].includes(role.code)
    );

    if (!hasAdminRole) {
      await this.authRepository.logLoginAttempt(
        user.id,
        email,
        false,
        ipAddress,
        userAgent,
        'No admin role',
      );
      throw new UnauthorizedException('Accès non autorisé. Vous n\'avez pas les droits administrateur.');
    }

    // 3. Réinitialiser les tentatives de connexion échouées
    await this.usersService.resetFailedLoginAttempts(user.id);

    // 4. Journaliser la tentative réussie
    await this.authRepository.logLoginAttempt(
      user.id,
      email,
      true,
      ipAddress,
      userAgent,
    );

    // 5. Générer les tokens
    const payload = {
      sub: user.id,
      email: user.email,
      roles: userRoles.map(r => r.code),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    // 6. Mettre à jour la dernière connexion
    await this.usersService.updateLastLogin(user.id);

    // 7. Log d'audit admin
    // await this.authRepository.logAdminAction({
    //   userId: user.id,
    //   action: 'ADMIN_LOGIN',
    //   ipAddress,
    //   userAgent,
    //   details: { email: user.email, roles: userRoles.map(r => r.code) }
    // });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: userRoles.map((r) => r.code),
        permissions: this.getPermissionsFromRoles(userRoles),
        image: user.profilePhotoUrl,
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
        copaEditionId: registerDto.copaEditionId,
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
   * Valide un token de réinitialisation (version Redis)
   */
  async validateResetToken(token: string, email: string): Promise<boolean> {
    try {
      // Normaliser l'email
      const normalizedEmail = email.toLowerCase().trim();

      this.logger.debug(`Validation token pour email: ${normalizedEmail}`);

      // 1. Vérifier d'abord dans Redis
      if (this.redis) {
        const tokenKey = `password_reset:${token}`;
        const tokenData = await this.redis.get(tokenKey);

        if (tokenData) {
          try {
            const { userId, email: tokenEmail, used } = JSON.parse(tokenData);

            // Vérifier si déjà utilisé
            if (used) {
              this.logger.warn(
                `Token déjà utilisé: ${token.substring(0, 8)}...`,
              );
              return false;
            }

            // Vérifier l'email
            if (tokenEmail.toLowerCase() !== normalizedEmail) {
              this.logger.warn(
                `Email mismatch: ${tokenEmail} vs ${normalizedEmail}`,
              );
              return false;
            }

            this.logger.log(`Token Redis valide pour user ${userId}`);
            return true;
          } catch (parseError) {
            this.logger.error('Erreur parsing tokenData Redis:', parseError);
          }
        } else {
          this.logger.debug(
            `Token non trouvé dans Redis: ${token.substring(0, 8)}...`,
          );
        }
      }

      // 2. Fallback: vérifier dans la base de données
      this.logger.debug('Fallback vers vérification DB');
      const user = await this.usersService.findByResetToken(token);

      if (!user) {
        this.logger.warn(
          `Aucun utilisateur trouvé avec ce token: ${token.substring(0, 8)}...`,
        );
        return false;
      }

      this.logger.debug(`User trouvé: ${user.id}, email: ${user.email}`);

      // Vérifier l'email
      if (user.email.toLowerCase() !== normalizedEmail) {
        this.logger.warn(
          `Email mismatch DB: ${user.email} vs ${normalizedEmail}`,
        );
        return false;
      }

      // Vérifier si le compte est actif
      if (!user.isActive || user.isBlocked) {
        this.logger.warn(`Compte inactif/bloqué: ${user.id}`);
        return false;
      }

      // Vérifier si le token a expiré
      if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
        this.logger.warn(
          `Token expiré pour user ${user.id}, expiration: ${user.resetTokenExpiresAt}`,
        );
        return false;
      }

      this.logger.log(`Token DB valide pour user ${user.id}`);
      return true;
    } catch (error) {
      this.logger.error('Erreur lors de la validation du token:', error);
      return false;
    }
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

  // async forgotPassword(email: string): Promise<{ message: string }> {
  //   const user = await this.usersService.findByEmail(email);

  //   if (!user) {
  //     // Return success even if user not found for security
  //     return { message: 'If your email exists, you will receive a reset link' };
  //   }

  //   const resetToken = uuidv4();
  //   const expiresAt = new Date();
  //   expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

  //   await this.usersService.setResetToken(user.id, resetToken, expiresAt);

  //   // TODO: Send email with reset link
  //   // await this.notificationsService.sendPasswordResetEmail(user.email, resetToken);

  //   return { message: 'If your email exists, you will receive a reset link' };
  // }

  // async resetPassword(
  //   token: string,
  //   newPassword: string,
  // ): Promise<{ message: string }> {
  //   const user = await this.usersService.findByResetToken(token);

  //   if (!user) {
  //     throw new BadRequestException('Invalid or expired reset token');
  //   }

  //   const saltRounds = this.configService.get('app.bcryptSaltRounds');
  //   const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  //   await this.usersService.updatePassword(user.id, passwordHash);
  //   await this.usersService.clearResetToken(user.id);

  //   return { message: 'Password successfully reset' };
  // }
  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      // Normaliser l'email
      const normalizedEmail = email.toLowerCase().trim();

      // Rechercher l'utilisateur
      const user = await this.usersService.findByEmail(normalizedEmail);

      // Pour des raisons de sécurité, on retourne le même message que l'utilisateur existe ou non
      if (!user) {
        this.logger.log(
          `Tentative de réinitialisation pour email non existant: ${normalizedEmail}`,
        );
        return {
          message:
            'Si votre email existe dans notre système, vous recevrez un lien de réinitialisation',
        };
      }

      // Vérifier si l'utilisateur est actif
      if (!user.isActive || user.isBlocked) {
        this.logger.warn(
          `Tentative de réinitialisation pour compte inactif/bloqué: ${user.id}`,
        );
        return {
          message:
            'Si votre email existe dans notre système, vous recevrez un lien de réinitialisation',
        };
      }

      // Vérifier le rate limiting (max 3 demandes par heure)
      const rateLimitKey = `forgot_password:rate:${user.id}`;
      const requests = await this.redis.get(rateLimitKey);

      if (requests && parseInt(requests) >= 3) {
        this.logger.warn(`Rate limit dépassé pour l'utilisateur ${user.id}`);
        throw new BadRequestException(
          'Trop de tentatives. Veuillez attendre 1 heure avant de réessayer.',
        );
      }

      // Incrémenter le compteur de rate limiting
      await this.redis
        .multi()
        .incr(rateLimitKey)
        .expire(rateLimitKey, 3600) // Expire après 1 heure
        .exec();

      // Générer un token sécurisé
      const resetToken = this.generateSecureToken();

      // Stocker le token dans Redis avec une expiration de 30 minutes
      const tokenKey = `password_reset:${resetToken}`;
      await this.redis.setex(
        tokenKey,
        1800, // 30 minutes en secondes
        JSON.stringify({
          userId: user.id,
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
          used: false,
        }),
      );

      this.logger.debug(`Clé Redis: ${tokenKey}`);

      const storedData = await this.redis.get(tokenKey);
      this.logger.debug(
        `Données stockées vérifiées: ${storedData ? 'OK' : 'ECHEC'}`,
      );

      // Révoquer les anciens tokens pour cet utilisateur (optionnel)
      await this.revokeOldResetTokens(user.id);

      // Sauvegarder une référence du token dans la base de données (pour l'audit)
      await this.usersService.setResetToken(
        user.id,
        resetToken,
        new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      );

      // Construire le lien de réinitialisation
      const frontendUrl =
        this.configService.get('APP_FRONTEND_URL') || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(
        normalizedEmail,
      )}`;

      // Envoyer l'email avec le lien
      try {
        await this.notificationsService.sendPasswordResetEmail({
          to: user.email,
          template: 'password-reset',
          data: {
            firstName: user.firstName,
            resetLink,
            expiresIn: '30 minutes',
            supportEmail:
              this.configService.get('SUPPORT_EMAIL') || 'support@copa.bi',
          },
        });

        this.logger.log(`Email de réinitialisation envoyé à ${user.email}`);
      } catch (emailError) {
        this.logger.error(
          `Erreur lors de l'envoi de l'email de réinitialisation à ${user.email}:`,
          emailError,
        );

        // Nettoyer le token si l'email échoue
        await this.redis.del(tokenKey);
        await this.usersService.clearResetToken(user.id);

        throw new InternalServerErrorException(
          "Erreur lors de l'envoi de l'email. Veuillez réessayer plus tard.",
        );
      }

      return {
        message:
          'Si votre email existe dans notre système, vous recevrez un lien de réinitialisation',
      };
    } catch (error) {
      // Log l'erreur mais retourner un message générique pour la sécurité
      this.logger.error('Erreur dans forgotPassword:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Une erreur est survenue. Veuillez réessayer plus tard.',
      );
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    try {
      // Valider le format du token
      if (!token || token.length < 32) {
        throw new BadRequestException('Token de réinitialisation invalide');
      }

      // Valider la force du mot de passe
      this.validatePasswordStrength(newPassword);

      // Vérifier le token dans Redis
      const tokenKey = `password_reset:${token}`;
      const tokenData = await this.redis.get(tokenKey);

      if (!tokenData) {
        // Vérifier dans la base de données comme fallback (pour compatibilité)
        const user = await this.usersService.findByResetToken(token);

        if (!user) {
          this.logger.warn(
            `Tentative de reset avec token invalide/expiré: ${token.substring(0, 8)}...`,
          );
          throw new BadRequestException(
            'Le lien de réinitialisation est invalide ou a expiré. Veuillez en demander un nouveau.',
          );
        }

        // Vérifier si le token n'est pas expiré
        if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
          throw new BadRequestException(
            'Le lien de réinitialisation a expiré. Veuillez en demander un nouveau.',
          );
        }

        // Utiliser le user trouvé en base
        return await this.completePasswordReset(
          user,
          newPassword,
          ipAddress,
          userAgent,
          token,
        );
      }

      // Parse les données du token Redis
      const { userId, email, used } = JSON.parse(tokenData);

      // Vérifier si le token a déjà été utilisé
      if (used) {
        this.logger.warn(
          `Tentative de réutilisation d'un token déjà utilisé: ${userId}`,
        );
        throw new BadRequestException(
          'Ce lien de réinitialisation a déjà été utilisé. Veuillez en demander un nouveau.',
        );
      }

      // Récupérer l'utilisateur
      const user = await this.usersService.findById(userId);

      if (!user) {
        this.logger.error(`Utilisateur non trouvé pour le token: ${userId}`);
        throw new BadRequestException('Token de réinitialisation invalide');
      }

      // Vérifier que l'email correspond
      if (user.email.toLowerCase() !== email.toLowerCase()) {
        this.logger.error(
          `Email mismatch pour le reset: ${user.email} vs ${email}`,
        );
        throw new BadRequestException('Token de réinitialisation invalide');
      }

      // Marquer le token comme utilisé dans Redis
      await this.redis.setex(
        tokenKey,
        1800, // Garder pour 30 min mais marqué comme utilisé
        JSON.stringify({
          userId,
          email,
          createdAt: new Date().toISOString(),
          used: true,
          usedAt: new Date().toISOString(),
          usedByIp: ipAddress,
        }),
      );

      return await this.completePasswordReset(
        user,
        newPassword,
        ipAddress,
        userAgent,
        token,
      );
    } catch (error) {
      this.logger.error('Erreur dans resetPassword:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Une erreur est survenue lors de la réinitialisation du mot de passe.',
      );
    }
  }

  private async completePasswordReset(
    user: User,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
    token?: string,
  ): Promise<{ message: string }> {
    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        "Le nouveau mot de passe doit être différent de l'ancien.",
      );
    }

    // Hasher le nouveau mot de passe
    const saltRounds =
      parseInt(this.configService.get('app.bcryptSaltRounds') || '10') || 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe dans une transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Mettre à jour le mot de passe
      await this.usersService.updatePassword(user.id, passwordHash);

      // Effacer le token de réinitialisation
      await this.usersService.clearResetToken(user.id);

      // Révoquer tous les refresh tokens actifs (déconnecter de tous les appareils)
      await this.authRepository.revokeAllUserRefreshTokens(user.id);

      // Journaliser le changement de mot de passe
      await this.authRepository.logPasswordReset({
        userId: user.id,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });

      // Envoyer une notification par email
      try {
        await this.notificationsService.sendPasswordChangedEmail({
          to: user.email,
          template: 'password-changed',
          data: {
            firstName: user.firstName,
            changeTime: new Date().toLocaleString('fr-FR'),
            ipAddress: ipAddress || 'Non disponible',
            supportEmail:
              this.configService.get('SUPPORT_EMAIL') || 'support@copa.bi',
          },
        });
      } catch (emailError) {
        // Ne pas bloquer le processus si l'email échoue
        this.logger.error(
          `Erreur lors de l'envoi de la notification de changement de mot de passe à ${user.email}:`,
          emailError,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Mot de passe réinitialisé avec succès pour l'utilisateur ${user.id}`,
      );

      return {
        message:
          'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async revokeOldResetTokens(userId: number): Promise<void> {
    try {
      // Trouver tous les tokens Redis pour cet utilisateur
      const pattern = `password_reset:*`;
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const { userId: tokenUserId } = JSON.parse(data);
          if (tokenUserId === userId) {
            // Marquer comme révoqué ou supprimer
            await this.redis.del(key);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la révocation des anciens tokens: ${error.message}`,
      );
    }
  }

  private generateSecureToken(): string {
    // Générer un token plus sécurisé que uuidv4
    return randomBytes(32).toString('hex');
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caractères',
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins une majuscule',
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins une minuscule',
      );
    }

    if (!/[0-9]/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins un chiffre',
      );
    }

    if (!/[!@#$%^&*]/.test(password)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)',
      );
    }
  }

  // Ajouter une méthode pour nettoyer les tokens expirés (pour cron job)
  async cleanExpiredResetTokens(): Promise<number> {
    try {
      // Nettoyer les tokens Redis expirés (Redis le fait automatiquement)
      // Nettoyer les tokens en base de données
      const result = await this.userRepo.update(
        {
          resetTokenExpiresAt: LessThan(new Date()),
        },
        {
          resetToken: undefined,
          resetTokenExpiresAt: undefined,
        },
      );

      this.logger.log(
        `${result.affected || 0} tokens de réinitialisation expirés nettoyés`,
      );

      return result.affected || 0;
    } catch (error) {
      this.logger.error('Erreur lors du nettoyage des tokens expirés:', error);
      return 0;
    }
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

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findById(userId);

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    // Vérifier que le nouveau mot de passe est différent
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        `Le nouveau mot de passe doit être différent de l'ancien`,
      );
    }

    // Hasher le nouveau mot de passe
    const saltRounds = this.configService.get('app.bcryptSaltRounds');
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    // Mettre à jour le mot de passe
    await this.usersService.updatePassword(userId, passwordHash);

    // Révoquer tous les tokens de rafraîchissement
    await this.authRepository.revokeAllUserRefreshTokens(userId);

    // Journaliser le changement
    this.logger.log(`Password changed for user ${userId}`);
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

  /**
   * Récupère les rôles d'un utilisateur
   */
  async getUserRoles(userId: number): Promise<Role[]> {
    const userRoles = await this.dataSource
      .getRepository(UserRole)
      .find({
        where: { userId, isActive: true },
        relations: ['role'],
      });

    return userRoles.map(ur => ur.role).filter(r => r && r.isActive);
  }

  /**
   * Génère les permissions basées sur les rôles
   */
  private getPermissionsFromRoles(roles: Role[]): string[] {
    const rolePermissions: Record<string, string[]> = {
      SUPER_ADMIN: [
        'view_all', 'edit_all', 'delete_all',
        'manage_users', 'manage_roles', 'view_audit_logs',
        'manage_beneficiaries', 'manage_business_plans', 'manage_evaluations',
        'manage_subventions', 'view_reports'
      ],
      ADMIN: [
        'view_all', 'edit_all',
        'manage_beneficiaries', 'manage_business_plans', 'manage_evaluations',
        'manage_subventions', 'view_reports'
      ],
      COPA_MANAGER: [
        'view_all', 'manage_beneficiaries', 'manage_business_plans',
        'view_reports'
      ],
    };

    const permissions = new Set<string>();
    for (const role of roles) {
      if (rolePermissions[role.code]) {
        rolePermissions[role.code].forEach(p => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }
}
