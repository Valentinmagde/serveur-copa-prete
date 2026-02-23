import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginAttempt } from './entities/login-attempt.entity';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
  ) {}

  async saveRefreshToken(token: RefreshToken): Promise<RefreshToken> {
    return this.refreshTokenRepository.save(token);
  }

  async findValidRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: {
        token,
        isRevoked: false,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { token },
    });
  }

  async revokeRefreshToken(id: number): Promise<void> {
    await this.refreshTokenRepository.update(id, {
      isRevoked: true,
      revokedAt: new Date(),
    });
  }

  async logLoginAttempt(
    userId: number | null,
    email: string | null,
    wasSuccessful: boolean,
    ipAddress: string,
    userAgent: string,
    failureReason?: string,
  ): Promise<LoginAttempt> {
    const loginAttemptData: Partial<LoginAttempt> = {
      userId: userId || undefined,
      email: email || undefined,
      wasSuccessful,
      ipAddress,
      userAgent,
      failureReason,
    };

    const loginAttempt = this.loginAttemptRepository.create(loginAttemptData);
    return this.loginAttemptRepository.save(loginAttempt);
  }

  async getRecentLoginAttempts(
    userId: number,
    minutes: number = 30,
  ): Promise<LoginAttempt[]> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - minutes);

    return this.loginAttemptRepository.find({
      where: {
        userId,
        createdAt: since,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getFailedLoginAttempts(
    email: string,
    minutes: number = 30,
  ): Promise<number> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - minutes);

    return this.loginAttemptRepository.count({
      where: {
        email,
        wasSuccessful: false,
        createdAt: since,
      },
    });
  }

  async getLastSuccessfulLogin(userId: number): Promise<LoginAttempt | null> {
    return this.loginAttemptRepository.findOne({
      where: {
        userId,
        wasSuccessful: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async cleanupOldAttempts(days: number = 30): Promise<number> {
    const before = new Date();
    before.setDate(before.getDate() - days);

    const result = await this.loginAttemptRepository.delete({
      createdAt: LessThan(before),
    });

    return result.affected || 0;
  }
}
