import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, DataSource } from 'typeorm';

import { User } from './entities/user.entity';
import {
  PaginationUtil,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { CreateUserDto, UserStatus } from './dto/create-user.dto';
import { Role } from '../reference/entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { UserConsent } from './entities/user-consent.entity';
import { UserFilterDto } from './dto/user-filter.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from '../notifications/notifications.service';
import { S3Service } from '../documents/storage/s3.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserConsent)
    private readonly userConsentRepository: Repository<UserConsent>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly s3Service: S3Service,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  /**
   * Crée un nouvel utilisateur avec son rôle
   */
  async createUserWithRole(
    createUserDto: CreateUserDto,
    createdByUserId: number,
  ): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Vérifier si l'email existe déjà
      const existingUser = await this.userRepository.findOne({
        where: { email: createUserDto.email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictException('Cet email est déjà utilisé');
      }

      // 2. Vérifier si le téléphone existe déjà
      if (createUserDto.phoneNumber) {
        const existingPhone = await this.userRepository.findOne({
          where: { phoneNumber: createUserDto.phoneNumber },
        });
        if (existingPhone) {
          throw new ConflictException(
            'Ce numéro de téléphone est déjà utilisé',
          );
        }
      }

      // 3. Vérifier si le rôle existe
      const role = await this.roleRepository.findOne({
        where: { code: createUserDto.roleCode, isActive: true },
      });

      if (!role) {
        throw new NotFoundException(
          `Le rôle ${createUserDto.roleCode} n'existe pas`,
        );
      }

      // 4. Hasher le mot de passe
      const saltRounds = parseInt(
        this.configService.get('app.bcryptSaltRounds') || '10',
      );
      const passwordHash = await bcrypt.hash(
        createUserDto.password,
        saltRounds,
      );

      // 5. Déterminer le statut
      const isActive = createUserDto.status === UserStatus.ACTIVE;
      const isVerified = createUserDto.status !== UserStatus.PENDING;

      // 6. Créer l'utilisateur
      const user = this.userRepository.create({
        email: createUserDto.email.toLowerCase(),
        passwordHash,
        firstName: this.capitalizeFirstLetter(createUserDto.firstName),
        lastName: this.capitalizeFirstLetter(createUserDto.lastName),
        phoneNumber: createUserDto.phoneNumber,
        isActive,
        isVerified,
        isBlocked: false,
        failedLoginAttempts: 0,
        createdByIp: 'system', // ou récupérer l'IP du créateur
      });

      const savedUser = await queryRunner.manager.save(user);

      // 7. Créer l'assignation du rôle
      const userRole = this.userRoleRepository.create({
        userId: savedUser.id,
        roleId: role.id,
        isActive: true,
        startDate: new Date(),
        assignedByUserId: createdByUserId,
        assignmentReason:
          createUserDto.assignmentReason || 'Création par administrateur',
        copaEditionId: createUserDto.copaEditionId,
      });

      await queryRunner.manager.save(userRole);

      // 8. Commit transaction
      await queryRunner.commitTransaction();

      await this.sendAccountCreatedEmail(
        savedUser,
        role,
        createUserDto.password,
      );

      // 9. Retourner la réponse
      return {
        id: savedUser.id,
        birthDate: savedUser.birthDate,
        nationality: savedUser.nationality,
        isRefugee: savedUser.isRefugee,
        isBlocked: savedUser.isBlocked,
        uuid: savedUser.uuid,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        phoneNumber: savedUser.phoneNumber,
        role: role.name,
        roleCode: role.code,
        status: this.getUserStatus(savedUser),
        isActive: savedUser.isActive,
        isVerified: savedUser.isVerified,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crée plusieurs utilisateurs en une fois
   */
  async createMultipleUsers(
    createUsersDto: CreateUserDto[],
    createdByUserId: number,
  ): Promise<UserResponseDto[]> {
    const results: UserResponseDto[] = [];
    const errors: Array<{ email: string; error: string }> = [];

    for (const dto of createUsersDto) {
      try {
        const user = await this.createUserWithRole(dto, createdByUserId);
        results.push(user);
      } catch (error) {
        errors.push({
          email: dto.email,
          error: error.message,
        });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: `Certains utilisateurs n'ont pas pu être créés`,
        errors,
        created: results,
      });
    }

    return results;
  }

  /**
   * Récupère les rôles disponibles pour l'assignation
   */
  async getAvailableRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isActive: true },
      order: { level: 'DESC' },
    });
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private getUserStatus(user: User): string {
    if (!user.isActive) return 'inactive';
    if (!user.isVerified) return 'pending';
    return 'active';
  }

  async findAll(filterDto: UserFilterDto): Promise<PaginatedResult<User>> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      isVerified,
      isBlocked,
    } = filterDto;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const where: FindOptionsWhere<User> = {};

    if (search) {
      where.firstName = ILike(`%${search}%`);
      // You can add more search conditions
    }

    if (isActive !== undefined) where.isActive = isActive;
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (isBlocked !== undefined) where.isBlocked = isBlocked;

    const [users, total] = await this.userRepository.findAndCount({
      where,
      skip,
      take,
      relations: ['gender', 'primaryAddress'],
      order: { createdAt: 'DESC' },
    });

    return PaginationUtil.paginate(users, total, { page, limit });
  }

  async findAllWithFilters(
    filterDto: UserFilterDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, search, status, role } = filterDto as any;

    const ADMIN_ROLES = [
      'SUPER_ADMIN',
      'ADMIN',
      'COPA_MANAGER',
      'EVALUATOR',
      'TRAINER',
      'MENTOR',
      'PARTNER',
    ];

    const query = this.userRepository
      .createQueryBuilder('user')
      .innerJoinAndSelect(
        'user.userRoles',
        'userRole',
        'userRole.isActive = true',
      )
      .innerJoinAndSelect(
        'userRole.role',
        'role',
        'role.code IN (:...adminRoles)',
        { adminRoles: ADMIN_ROLES },
      )
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phoneNumber',
        'user.profilePhotoUrl',
        'user.isActive',
        'user.isBlocked',
        'user.isVerified',
        'user.lastLoginAt',
        'user.createdAt',
        'userRole.id',
        'role.id',
        'role.code',
        'role.name',
      ]);

    // Filtre recherche
    if (search) {
      query.andWhere(
        '(user.firstName ILIKE :s OR user.lastName ILIKE :s OR user.email ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    // Filtre statut
    if (status) {
      if (status === 'Active') {
        query
          .andWhere('user.isActive = true')
          .andWhere('user.isBlocked = false')
          .andWhere('user.isVerified = true');
      }
      if (status === 'Deactivated') query.andWhere('user.isActive = false');
      if (status === 'Pending') query.andWhere('user.isVerified = false');
    }

    // Filtre rôle spécifique
    if (role && ADMIN_ROLES.includes(role)) {
      query.andWhere('role.code = :role', { role });
    }

    const [users, total] = await query
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Formater la réponse
    const data = users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.userRoles?.[0]?.role?.name || 'Sans rôle',
      roleCode: user.userRoles?.[0]?.role?.code || null,
      status: !user.isActive
        ? 'Deactivated'
        : !user.isVerified
          ? 'Pending'
          : 'Active',
      isBlocked: user.isBlocked,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));

    return PaginationUtil.paginate(data, total, { page, limit });
  }

  async findById(id: number, relations: string[] = []): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Load roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId: id, isActive: true },
      relations: ['role'],
    });

    user.roles = userRoles.map((ur) => ur.role.code);

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (user) {
      user.roles = user.userRoles?.map((ur) => ur.role.code) || [];
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    const { role: roles, ...userData } = updateUserDto;

    Object.assign(user, userData);

    if (roles && Array.isArray(roles)) {
      const roleEntities = await this.roleRepository.find({
        where: roles.map((code) => ({ code, isActive: true })),
      });

      if (roleEntities.length !== roles.length) {
        const foundCodes = roleEntities.map((r) => r.code);
        const missingCodes = roles.filter((code) => !foundCodes.includes(code));
        throw new NotFoundException(
          `Roles not found: ${missingCodes.join(', ')}`,
        );
      }

      // Désactiver les anciens rôles
      await this.userRoleRepository.update(
        { userId: id, isActive: true },
        { isActive: false, endDate: new Date() },
      );

      // Créer les nouvelles assignations de rôles
      const userRoles = roleEntities.map((role) =>
        this.userRoleRepository.create({
          userId: id,
          roleId: role.id,
          isActive: true,
          startDate: new Date(),
        }),
      );

      await this.userRoleRepository.save(userRoles);
    }

    console.log('Updated user:', user);
    console.log('Update data:', updateUserDto);

    const savedUser = await this.userRepository.save(user);
    return this.findById(savedUser.id); // Recharger avec les relations
  }

  async delete(id: number): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    await this.userRepository.save(user);
  }

  async assignRole(userId: number, roleCode: string): Promise<void> {
    // const user = await this.findById(userId);
    const role = await this.roleRepository.findOne({
      where: { code: roleCode },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleCode} not found`);
    }

    const existingAssignment = await this.userRoleRepository.findOne({
      where: { userId, roleId: role.id, isActive: true },
    });

    if (existingAssignment) {
      throw new ConflictException('User already has this role');
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId: role.id,
      isActive: true,
    });

    await this.userRoleRepository.save(userRole);
  }

  async removeRole(userId: number, roleCode: string): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { code: roleCode },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleCode} not found`);
    }

    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId: role.id, isActive: true },
    });

    if (!userRole) {
      throw new NotFoundException('User does not have this role');
    }

    userRole.isActive = false;
    userRole.endDate = new Date();
    await this.userRoleRepository.save(userRole);
  }

  async getUserRoles(userId: number): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    return userRoles.map((ur) => ur.role.code);
  }

  async recordFailedLogin(userId: number): Promise<void> {
    const user = await this.findById(userId);
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= 5) {
      user.isBlocked = true;
      user.lastBlockedAt = new Date();
    }

    await this.userRepository.save(user);
  }

  async resetFailedLoginAttempts(userId: number): Promise<void> {
    const user = await this.findById(userId);
    user.failedLoginAttempts = 0;
    await this.userRepository.save(user);
  }

  async updateLastLogin(userId: number): Promise<void> {
    const user = await this.findById(userId);
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);
  }

  async setResetToken(
    userId: number,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const user = await this.findById(userId);
    user.resetToken = token;
    user.resetTokenExpiresAt = expiresAt;
    await this.userRepository.save(user);
  }

  async findByResetToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: {
        resetToken: token,
      },
    });
  }

  async clearResetToken(userId: number): Promise<void> {
    const user = await this.findById(userId);
    user.resetToken = null as any;
    user.resetTokenExpiresAt = null as any;
    await this.userRepository.save(user);
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const user = await this.findById(userId);
    user.passwordHash = passwordHash;
    await this.userRepository.save(user);
  }

  async saveConsent(
    userId: number,
    consentTypeId: number,
    value: boolean,
    ipAddress: string,
    userAgent: string,
  ): Promise<UserConsent> {
    let consent = await this.userConsentRepository.findOne({
      where: { userId, consentTypeId },
    });

    if (consent) {
      consent.value = value;
      consent.updatedAt = new Date();
    } else {
      consent = this.userConsentRepository.create({
        userId,
        consentTypeId,
        value,
        ipAddress,
        userAgent,
      });
    }

    return await this.userConsentRepository.save(consent);
  }

  async getUserConsents(userId: number): Promise<UserConsent[]> {
    return await this.userConsentRepository.find({
      where: { userId },
      relations: ['consentType'],
    });
  }

  async toggleUserBlock(userId: number, block: boolean): Promise<User> {
    const user = await this.findById(userId);
    user.isBlocked = block;
    if (block) {
      user.lastBlockedAt = new Date();
    }
    return await this.userRepository.save(user);
  }

  async verifyUser(userId: number): Promise<User> {
    const user = await this.findById(userId);
    user.isVerified = true;
    return await this.userRepository.save(user);
  }

  /**
   * Upload d'avatar pour un utilisateur
   */
  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{ url: string; key: string }> {
    try {
      // 1. Vérifier que l'utilisateur existe
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException(`Utilisateur avec ID ${userId} non trouvé`);
      }

      // 2. Valider le fichier
      if (!file) {
        throw new BadRequestException('Aucun fichier fourni');
      }

      // Vérifier le type MIME
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Format de fichier non autorisé. Formats acceptés: JPG, PNG, GIF, WEBP',
        );
      }

      // Vérifier la taille (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException(
          `Le fichier ne doit pas dépasser ${maxSize / (1024 * 1024)}MB`,
        );
      }

      // 3. Supprimer l'ancien avatar s'il existe
      if (user.profilePhotoUrl) {
        try {
          // Extraire la clé S3 de l'URL
          const oldKey = this.extractKeyFromUrl(user.profilePhotoUrl);
          if (oldKey) {
            await this.s3Service.deleteFile(oldKey);
            this.logger.log(
              `Ancien avatar supprimé pour l'utilisateur ${userId}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Erreur lors de la suppression de l'ancien avatar: ${error.message}`,
          );
          // On continue même si la suppression échoue
        }
      }

      // 4. Générer un nom de fichier unique
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const filename = `avatar-${userId}-${timestamp}.${extension}`;
      const folder = `avatars/${userId}`;

      // 5. Upload vers S3
      const key = await this.s3Service.uploadFile(
        file.buffer,
        `${folder}/${filename}`,
        file.mimetype,
      );

      // 6. Générer l'URL publique
      // const cloudfrontDomain = this.configService.get('CLOUDFRONT_DOMAIN');
      // const bucket = this.configService.get('AWS_S3_BUCKET');
      // const region = this.configService.get('AWS_REGION');

      // let url: string;
      // if (cloudfrontDomain) {
      //   url = `https://${cloudfrontDomain}/${key}`;
      // } else {
      //   // ⚠️ Ne pas ajouter le bucket dans l'URL si vous utilisez CloudFront
      //   url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
      // }

      // 7. Mettre à jour l'utilisateur
      user.profilePhotoUrl = key;
      await this.userRepository.save(user);

      this.logger.log(
        `Avatar uploadé avec succès pour l'utilisateur ${userId}`,
      );

      return { url: key, key };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'upload de l'avatar pour l'utilisateur ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Supprimer l'avatar d'un utilisateur
   */
  async deleteAvatar(userId: number): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundException(`Utilisateur avec ID ${userId} non trouvé`);
      }

      if (!user.profilePhotoUrl) {
        throw new BadRequestException('Aucun avatar à supprimer');
      }

      // Extraire la clé S3 de l'URL
      const key = this.extractKeyFromUrl(user.profilePhotoUrl);
      if (key) {
        await this.s3Service.deleteFile(key);
        this.logger.log(`Avatar supprimé pour l'utilisateur ${userId}`);
      }

      // Supprimer l'URL de la base de données
      user.profilePhotoUrl = '';
      await this.userRepository.save(user);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression de l'avatar pour l'utilisateur ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Mettre à jour le profil utilisateur (incluant l'avatar)
   */
  async updateProfile(
    userId: number,
    updateData: UpdateUserDto,
    avatarFile?: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(`Utilisateur avec ID ${userId} non trouvé`);
    }

    // Si un avatar est fourni, l'uploader d'abord
    let avatarUrl = user.profilePhotoUrl;
    if (avatarFile) {
      const { url } = await this.uploadAvatar(userId, avatarFile);
      avatarUrl = url;
    }

    // Mettre à jour les autres champs
    const updatedUser = await this.update(userId, {
      ...updateData,
      profilePhotoUrl: avatarUrl,
    });

    return this.mapToResponseDto(updatedUser);
  }

  /**
   * Extraire la clé S3 d'une URL
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      // Format: https://bucket.s3.region.amazonaws.com/avatars/123/avatar-123-123456789.jpg
      // ou https://cloudfront.net/avatars/123/avatar-123-123456789.jpg
      const urlObj = new URL(url);
      const key = urlObj.pathname.substring(1); // Enlever le premier slash
      return key;
    } catch {
      this.logger.warn(
        `Erreur lors de l'extraction de la clé de l'URL: ${url}`,
      );
      return null;
    }
  }

  /**
   * Mapper un utilisateur vers DTO de réponse
   */
  private mapToResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.userRoles?.[0]?.role?.name || '',
      roleCode: user.userRoles?.[0]?.role?.code || '',
      status: this.getUserStatus(user),
      isActive: user.isActive,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Envoie un email avec les informations de connexion
   */
  private async sendAccountCreatedEmail(
    user: User,
    role: Role,
    plainPassword: string,
  ): Promise<void> {
    try {
      const backofficeUrl =
        this.configService.get('APP_BACKOFFICE_URL') || 'http://localhost:3002';

      // Préparer les données pour l'email
      const emailData = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: plainPassword,
        role: role.name,
        roleCode: role.code,
        loginUrl: `${backofficeUrl}`,
        supportEmail:
          this.configService.get('SUPPORT_EMAIL') || 'support@copa-prete.bi',
        supportPhone: this.configService.get('SUPPORT_PHONE') || '+257XXXXXXXX',
      };

      // Envoyer l'email
      await this.notificationsService.sendAccountCreatedEmail(emailData);

      this.logger.log(`Email de création de compte envoyé à ${user.email}`);
    } catch (error) {
      this.logger.error(`Erreur envoi email à ${user.email}:`, error);
      // Ne pas bloquer la création du compte si l'email échoue
    }
  }
}
