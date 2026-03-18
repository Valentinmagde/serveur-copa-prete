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

  /**
   * Révoque tous les refresh tokens actifs d'un utilisateur
   */
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        userId,
        isRevoked: false,
      },
      {
        isRevoked: true,
        revokedAt: new Date(),
      },
    );
  }

  /**
   * Révoque tous les refresh tokens expirés
   */
  async revokeExpiredRefreshTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.update(
      {
        expiresAt: LessThan(new Date()),
        isRevoked: false,
      },
      {
        isRevoked: true,
        revokedAt: new Date(),
      },
    );

    return result.affected || 0;
  }

  /**
   * Journalise une réinitialisation de mot de passe
   */
  async logPasswordReset(data: {
    userId: number;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
  }): Promise<LoginAttempt> {
    // Récupérer l'email de l'utilisateur (optionnel)
    // Note: Vous devrez peut-être passer l'email en paramètre ou le récupérer autrement
    const loginAttemptData: Partial<LoginAttempt> = {
      userId: data.userId,
      email: undefined, // Vous pouvez passer l'email si disponible
      wasSuccessful: true,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      failureReason: 'PASSWORD_RESET', // Utilisé pour identifier le type d'événement
    };

    const loginAttempt = this.loginAttemptRepository.create(loginAttemptData);
    return this.loginAttemptRepository.save(loginAttempt);
  }

  /**
   * Récupère l'historique des réinitialisations de mot de passe
   */
  async getPasswordResetHistory(
    userId: number,
    limit: number = 10,
  ): Promise<LoginAttempt[]> {
    return this.loginAttemptRepository.find({
      where: {
        userId,
        failureReason: 'PASSWORD_RESET',
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Nettoie les anciens tokens de rafraîchissement
   */
  async cleanupOldRefreshTokens(days: number = 90): Promise<number> {
    const before = new Date();
    before.setDate(before.getDate() - days);

    const result = await this.refreshTokenRepository.delete({
      createdAt: LessThan(before),
      isRevoked: true, // Ne supprimer que les tokens déjà révoqués
    });

    return result.affected || 0;
  }

  /**
   * Compte les tokens actifs d'un utilisateur
   */
  async countActiveRefreshTokens(userId: number): Promise<number> {
    return this.refreshTokenRepository.count({
      where: {
        userId,
        isRevoked: false,
        expiresAt: LessThan(new Date()), // Tokens non expirés
      },
    });
  }

  /**
   * Récupère tous les tokens actifs d'un utilisateur
   */
  async findActiveRefreshTokens(userId: number): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: LessThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Statistiques des tentatives de connexion
   */
  async getLoginStats(
    userId: number,
    days: number = 30,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    lastLogin: Date | null;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [total, successful, failed, lastLogin] = await Promise.all([
      this.loginAttemptRepository.count({
        where: {
          userId,
          createdAt: LessThan(since),
        },
      }),
      this.loginAttemptRepository.count({
        where: {
          userId,
          wasSuccessful: true,
          createdAt: LessThan(since),
        },
      }),
      this.loginAttemptRepository.count({
        where: {
          userId,
          wasSuccessful: false,
          createdAt: LessThan(since),
        },
      }),
      this.getLastSuccessfulLogin(userId),
    ]);

    return {
      total,
      successful,
      failed,
      lastLogin: lastLogin?.createdAt || null,
    };
  }
}
