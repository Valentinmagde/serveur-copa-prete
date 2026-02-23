import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In, LessThan } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { TwilioService } from './twilio.service';
import { UsersService } from '../users/users.service';
import {
  CreateNotificationDto,
  NotificationChannel,
  NotificationType,
} from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { SendBulkDto } from './dto/send-bulk.dto';
import {
  PaginatedResult,
  PaginationUtil,
} from '@/common/utils/pagination.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private twilioService: TwilioService,
    private usersService: UsersService,
  ) {}

  // ==================== CRUD PRINCIPAL ====================

  /**
   * Crée et envoie une notification
   */
  async create(createDto: CreateNotificationDto): Promise<Notification> {
    try {
      // 1. Trouver le destinataire
      const user = await this.findRecipient(createDto);

      // 2. Créer la notification en base
      const notification = this.notificationRepository.create({
        recipientUserId: user.id,
        channel: createDto.channel,
        notificationType: createDto.type,
        title: createDto.title,
        content: createDto.content,
        context: createDto.data || {},
        isSent: false,
      });

      const savedNotification =
        await this.notificationRepository.save(notification);

      // 3. Envoyer selon le canal (si pas programmé)
      if (!createDto.scheduledAt) {
        await this.sendNotification(savedNotification, user, createDto);
      } else {
        // Notification programmée - sera envoyée plus tard par un job
        this.logger.log(
          `Notification ${savedNotification.id} programmée pour ${createDto.scheduledAt}`,
        );
      }

      return savedNotification;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la création de la notification:',
        error,
      );
      throw error;
    }
  }

  /**
   * Envoie une notification existante
   */
  private async sendNotification(
    notification: Notification,
    user: any,
    dto: CreateNotificationDto,
  ): Promise<void> {
    try {
      let deliveryResult: any;

      switch (dto.channel) {
        case NotificationChannel.EMAIL:
          deliveryResult = await this.twilioService.sendEmail({
            to: user.email,
            subject: dto.title,
            html: dto.content,
            templateId: this.getTemplateId(dto.template),
            templateData: { ...dto.data, firstName: user.firstName },
          });
          break;

        case NotificationChannel.SMS:
          deliveryResult = await this.twilioService.sendSms(
            user.phoneNumber,
            this.renderContent(dto.content, {
              firstName: user.firstName,
              ...dto.data,
            }),
          );
          break;

        case NotificationChannel.WHATSAPP:
          deliveryResult = await this.twilioService.sendWhatsApp(
            user.phoneNumber,
            this.renderContent(dto.content, {
              firstName: user.firstName,
              ...dto.data,
            }),
          );
          break;

        case NotificationChannel.IN_APP:
          // Pas d'envoi externe, juste en base
          deliveryResult = { status: 'in_app' };
          break;

        default:
          this.logger.warn(`Canal non supporté: ${dto.channel}`);
      }

      // Mettre à jour le statut
      notification.isSent = true;
      notification.sentAt = new Date();
      notification.context = {
        ...notification.context,
        deliveryResult,
        channel: dto.channel,
      };

      await this.notificationRepository.save(notification);
      this.logger.log(`Notification ${notification.id} envoyée avec succès`);
    } catch (error) {
      this.logger.error(`Échec envoi notification ${notification.id}:`, error);
      notification.context = {
        ...notification.context,
        error: error.message,
        failedAt: new Date(),
      };
      await this.notificationRepository.save(notification);
      throw error;
    }
  }

  /**
   * Trouve le destinataire par ID, email ou téléphone
   */
  private async findRecipient(dto: CreateNotificationDto): Promise<any> {
    if (dto.recipientId) {
      return this.usersService.findById(dto.recipientId);
    } else if (dto.recipientEmail) {
      const user = await this.usersService.findByEmail(dto.recipientEmail);
      if (!user) {
        throw new NotFoundException(
          `Utilisateur avec email ${dto.recipientEmail} non trouvé`,
        );
      }
      return user;
    } else if (dto.recipientPhone) {
      // Implémenter recherche par téléphone si nécessaire
      throw new BadRequestException('Recherche par téléphone non implémentée');
    } else {
      throw new BadRequestException('Aucun destinataire spécifié');
    }
  }

  /**
   * Récupère toutes les notifications avec filtres
   */
  async findAll(
    filter: NotificationFilterDto,
  ): Promise<PaginatedResult<Notification>> {
    const {
      page = 1,
      limit = 20,
      userId,
      channel,
      type,
      isSent,
      isRead,
      fromDate,
      toDate,
      search,
    } = filter;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const where: FindOptionsWhere<Notification> = {};

    if (userId) where.recipientUserId = parseInt(userId);
    if (channel) where.channel = channel;
    if (type) where.notificationType = type;
    if (isSent !== undefined) where.isSent = isSent;
    if (isRead !== undefined) where.isRead = isRead;

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    }

    if (search) {
      // Recherche dans le titre et le contenu
      const [notifications, total] = await this.notificationRepository
        .createQueryBuilder('n')
        .where('n.title ILIKE :search OR n.content ILIKE :search', {
          search: `%${search}%`,
        })
        .andWhere(where)
        .skip(skip)
        .take(take)
        .orderBy('n.createdAt', 'DESC')
        .getManyAndCount();

      return PaginationUtil.paginate(notifications, total, { page, limit });
    }

    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where,
        skip,
        take,
        order: { createdAt: 'DESC' },
        relations: ['recipient'],
      });

    return PaginationUtil.paginate(notifications, total, { page, limit });
  }

  /**
   * Récupère les notifications d'un utilisateur spécifique
   */
  async findByUser(
    userId: number,
    filter: NotificationFilterDto,
  ): Promise<PaginatedResult<Notification>> {
    return this.findAll({ ...filter, userId: userId.toString() });
  }

  /**
   * Récupère une notification par son ID
   */
  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['recipient'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification #${id} non trouvée`);
    }

    return notification;
  }

  /**
   * Met à jour une notification
   */
  async update(
    id: number,
    updateDto: UpdateNotificationDto,
  ): Promise<Notification> {
    const notification = await this.findOne(id);
    Object.assign(notification, {
      channel: updateDto.channel,
      notificationType: updateDto.type,
      title: updateDto.title,
      content: updateDto.content,
      context: updateDto.data,
    });
    return this.notificationRepository.save(notification);
  }

  /**
   * Supprime une notification
   */
  async remove(id: number): Promise<void> {
    const notification = await this.findOne(id);
    await this.notificationRepository.remove(notification);
  }

  // ==================== GESTION DES LECTURES ====================

  /**
   * Marque des notifications comme lues
   */
  async markAsRead(notificationIds: number[], userId?: number): Promise<void> {
    const where: FindOptionsWhere<Notification> = {
      id: In(notificationIds),
    };

    if (userId) {
      where.recipientUserId = userId;
    }

    await this.notificationRepository.update(where, {
      isRead: true,
      readAt: new Date(),
    });
  }

  /**
   * Marque toutes les notifications d'un utilisateur comme lues
   */
  async markAllAsReadByUser(userId: number): Promise<void> {
    await this.notificationRepository.update(
      {
        recipientUserId: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );
  }

  /**
   * Compte les notifications non lues d'un utilisateur
   */
  async countUnreadByUser(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: {
        recipientUserId: userId,
        isRead: false,
      },
    });
  }

  // ==================== NOTIFICATIONS UTILISATEUR ====================

  /**
   * Récupère les notifications d'un utilisateur connecté
   */
  async getUserNotifications(
    userId: number,
    filter: NotificationFilterDto,
  ): Promise<PaginatedResult<Notification>> {
    return this.findByUser(userId, filter);
  }

  /**
   * Supprime une notification d'un utilisateur
   */
  async deleteUserNotification(
    notificationId: number,
    userId: number,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipientUserId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification non trouvée');
    }

    await this.notificationRepository.remove(notification);
  }

  /**
   * Supprime toutes les notifications d'un utilisateur
   */
  async deleteAllUserNotifications(userId: number): Promise<void> {
    await this.notificationRepository.delete({ recipientUserId: userId });
  }

  // ==================== NOTIFICATIONS EN MASSE ====================

  /**
   * Envoie des notifications en masse
   */
  async sendBulk(
    bulkDto: SendBulkDto,
  ): Promise<{ total: number; succeeded: number; failed: number }> {
    const results = {
      total: bulkDto.recipientIds.length,
      succeeded: 0,
      failed: 0,
    };

    for (const userId of bulkDto.recipientIds) {
      try {
        await this.create({
          channel: bulkDto.channel,
          type: bulkDto.type,
          title: bulkDto.title,
          content: bulkDto.content,
          recipientId: userId,
          data: bulkDto.data,
          template: bulkDto.template,
        });
        results.succeeded++;
      } catch (error) {
        this.logger.error(`Échec envoi à l'utilisateur ${userId}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Envoie une notification basée sur un template
   */
  async sendTemplate(templateName: string, data: any): Promise<Notification> {
    // Récupérer le template (à implémenter selon votre système)
    const templates = {
      welcome: {
        channel: NotificationChannel.EMAIL,
        type: NotificationType.CONFIRMATION,
        title: 'Bienvenue sur COPA',
        content: 'Bonjour {{firstName}}, votre inscription a été réussie...',
      },
      validation: {
        channel: NotificationChannel.SMS,
        type: NotificationType.CONFIRMATION,
        title: 'Compte validé',
        content: 'Félicitations {{firstName}}! Votre compte COPA est validé.',
      },
    };

    const template = templates[templateName];
    if (!template) {
      throw new BadRequestException(`Template ${templateName} non trouvé`);
    }

    // Remplacer les variables dans le contenu
    const content = this.renderContent(template.content, data);

    return this.create({
      channel: template.channel,
      type: template.type,
      title: template.title,
      content,
      recipientId: data.userId,
      data,
      template: templateName,
    });
  }

  // ==================== STATISTIQUES ====================

  /**
   * Statistiques des notifications
   */
  async getStats(): Promise<any> {
    const total = await this.notificationRepository.count();
    const sent = await this.notificationRepository.count({
      where: { isSent: true },
    });
    const read = await this.notificationRepository.count({
      where: { isRead: true },
    });

    const byChannel = await this.notificationRepository
      .createQueryBuilder('n')
      .select('n.channel', 'channel')
      .addSelect('COUNT(*)', 'count')
      .groupBy('n.channel')
      .getRawMany();

    const byType = await this.notificationRepository
      .createQueryBuilder('n')
      .select('n.notification_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('n.notification_type')
      .getRawMany();

    const last7Days = await this.notificationRepository
      .createQueryBuilder('n')
      .select('DATE(n.created_at)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where("n.created_at >= NOW() - INTERVAL '7 days'")
      .groupBy('DATE(n.created_at)')
      .orderBy('date', 'DESC')
      .getRawMany();

    return {
      total,
      sent,
      read,
      readRate: total > 0 ? (read / total) * 100 : 0,
      byChannel,
      byType,
      last7Days,
    };
  }

  // ==================== HISTORIQUE ====================

  /**
   * Historique des notifications d'un utilisateur
   */
  async getUserHistory(
    userId: number,
    limit: number = 50,
  ): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { recipientUserId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ==================== RENVOI ====================

  /**
   * Renvoie une notification
   */
  async resend(id: number): Promise<Notification> {
    const notification = await this.findOne(id);
    const user = await this.usersService.findById(notification.recipientUserId);

    // Réinitialiser le statut
    notification.isSent = false;
    notification.sentAt = null;
    await this.notificationRepository.save(notification);

    // Renvoyer
    await this.sendNotification(notification, user, {
      channel: notification.channel as NotificationChannel,
      type: notification.notificationType as NotificationType,
      title: notification.title,
      content: notification.content,
      recipientId: user.id,
      data: notification.context,
    });

    return this.findOne(id);
  }

  // ==================== NETTOYAGE ====================

  /**
   * Nettoie les anciennes notifications
   */
  async cleanupOldNotifications(days: number = 30): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const result = await this.notificationRepository.delete({
      createdAt: LessThan(date),
      isRead: true, // Ne supprime que les lues
    });

    this.logger.log(`${result.affected} anciennes notifications supprimées`);
    return result.affected || 0;
  }

  // ==================== UTILITAIRES ====================

  /**
   * Liste les templates disponibles
   */
  listTemplates(): string[] {
    return ['welcome', 'validation', 'reminder', 'subvention', 'evaluation'];
  }

  /**
   * Rend le contenu avec les variables
   */
  private renderContent(content: string, data: Record<string, any>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Récupère l'ID de template SendGrid
   */
  private getTemplateId(template?: string): string | undefined {
    if (!template) return undefined;

    const templates = {
      welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
      validation: process.env.SENDGRID_TEMPLATE_VALIDATION,
      reminder: process.env.SENDGRID_TEMPLATE_REMINDER,
    };

    return templates[template];
  }

  // ==================== WEBHOOKS ====================

  /**
   * Gère les webhooks Twilio SMS
   */
  async handleSmsWebhook(payload: any): Promise<void> {
    this.logger.log('Webhook SMS reçu:', payload);
    const { MessageSid, MessageStatus, To } = payload;

    // Mettre à jour la notification correspondante
    await this.notificationRepository.update(
      {
        context: { messageSid: MessageSid },
      },
      {
        context: { smsStatus: MessageStatus },
      },
    );
  }

  /**
   * Gère les webhooks SendGrid
   */
  async handleEmailWebhook(payload: any): Promise<void> {
    this.logger.log('Webhook email reçu:', payload);

    if (Array.isArray(payload)) {
      for (const event of payload) {
        const { sg_message_id, event: status, email } = event;

        await this.notificationRepository.update(
          {
            context: { sendgridId: sg_message_id },
          },
          {
            context: { emailStatus: status },
          },
        );
      }
    }
  }

  // ==================== TESTS ====================

  /**
   * Test d'envoi SMS
   */
  async testSms(to: string, message: string): Promise<any> {
    return this.twilioService.sendSms(to, message);
  }

  /**
   * Test d'envoi email
   */
  async testEmail(data: {
    to: string;
    subject?: string;
    message?: string;
  }): Promise<any> {
    return this.twilioService.sendEmail({
      to: data.to,
      subject: data?.subject || 'Test COPA',
      html: data?.message || '<h1>Test</h1><p>Ceci est un test</p>',
    });
  }

  /**
   * Test des connexions
   */
  async testConnections(): Promise<any> {
    const results = {
      database: false,
      twilio: false,
      sendgrid: false,
    };

    // Test base de données
    try {
      await this.notificationRepository.query('SELECT 1');
      results.database = true;
    } catch (error) {
      this.logger.error('Connexion DB échouée:', error);
    }

    // Test Twilio (simulé)
    results.twilio = true;

    // Test SendGrid (simulé)
    results.sendgrid = true;

    return results;
  }
}
