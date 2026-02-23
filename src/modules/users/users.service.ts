import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';

import { User } from './entities/user.entity';
import {
  PaginationUtil,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../reference/entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { UserConsent } from './entities/user-consent.entity';
import { UserFilterDto } from './dto/user-filter.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserConsent)
    private readonly userConsentRepository: Repository<UserConsent>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
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

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async delete(id: number): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    await this.userRepository.save(user);
  }

  async assignRole(userId: number, roleCode: string): Promise<void> {
    const user = await this.findById(userId);
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
}
