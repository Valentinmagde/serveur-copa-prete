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
import {
  EmailTemplatesService,
  SmsTemplateType,
} from './templates/email-templates.service';
import { ConfigService } from '@nestjs/config';
import { activitiesUrl } from 'twilio/lib/jwt/taskrouter/util';
import { User } from 'aws-sdk/clients/budgets';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private twilioService: TwilioService,
    private usersService: UsersService,
    private emailTemplates: EmailTemplatesService,
    private configService: ConfigService,
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
            templateData: {
              ...dto.data,
              firstName: user.firstName,
              userName: user.firstName,
              year: new Date().getFullYear(),
            },
          });
          break;

        // Les autres cas restent identiques
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
          deliveryResult = { status: 'in_app' };
          break;
      }

      // Mise à jour du statut (inchangé)
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
   * Envoie des notifications pour un formulaire de contact
   * Utilise les templates de EmailTemplatesService
   */
  async sendContactNotification(
    contactData: {
      name: string;
      email: string;
      phone?: string;
      subject: string;
      message: string;
    },
    metadata?: {
      ip?: string;
      userAgent?: string;
      userId?: number;
    },
  ): Promise<{
    success: boolean;
    supportNotificationId?: number;
    userNotificationId?: number;
    error?: string;
  }> {
    try {
      this.logger.log(`Envoi notification de contact de ${contactData.email}`);

      const supportEmail =
        this.configService.get('SUPPORT_EMAIL') || 'contact@copa-prete.bi';

      // Vérifier si l'utilisateur existe
      let user: any;
      if (metadata?.userId) {
        user = await this.usersService.findById(metadata.userId);
      } else {
        user = await this.usersService.findByEmail(contactData.email);
      }

      // ========== 1. NOTIFICATION À L'ÉQUIPE SUPPORT ==========

      // Utiliser le template pour le support
      const adminTemplate = this.emailTemplates.getContactNotification({
        ...contactData,
        metadata,
      });

      // Envoyer l'email au support via Twilio
      const adminResult = await this.twilioService.sendEmail({
        to: supportEmail,
        subject: adminTemplate.subject,
        html: adminTemplate.html,
        text: adminTemplate.text,
      });

      // Créer la notification pour le support
      const supportNotification = this.notificationRepository.create({
        recipientUserId: null,
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.INFO,
        title: adminTemplate.subject,
        content: adminTemplate.html,
        context: {
          emailType: 'contact',
          messageId: adminResult.messageId,
          contactData,
          metadata,
        },
        isSent: true,
        sentAt: new Date(),
      });

      const savedSupportNotification =
        await this.notificationRepository.save(supportNotification);

      // ========== 2. CONFIRMATION À L'UTILISATEUR ==========

      let userNotification: any;
      let savedUserNotification: any;

      // N'envoyer la confirmation que si l'email n'est pas celui du support
      if (contactData.email.toLowerCase() !== supportEmail.toLowerCase()) {
        // Utiliser le template pour l'utilisateur
        const userTemplate =
          this.emailTemplates.getContactConfirmation(contactData);

        // Envoyer l'email de confirmation à l'utilisateur
        const userResult = await this.twilioService.sendEmail({
          to: contactData.email,
          subject: userTemplate.subject,
          html: userTemplate.html,
          text: userTemplate.text,
        });

        // Créer la notification pour l'utilisateur
        userNotification = this.notificationRepository.create({
          recipientUserId: user?.id || null,
          channel: NotificationChannel.EMAIL,
          notificationType: NotificationType.SUCCESS,
          title: userTemplate.subject,
          content: userTemplate.html,
          context: {
            emailType: 'contact_confirmation',
            messageId: userResult.messageId,
            contactData,
            supportNotificationId: savedSupportNotification.id,
          },
          isSent: true,
          sentAt: new Date(),
        });

        savedUserNotification =
          await this.notificationRepository.save(userNotification);
      }

      // ========== 4. NOTIFICATION IN-APP POUR L'UTILISATEUR (SI CONNECTÉ) ==========

      if (user) {
        try {
          const inAppNotification = this.notificationRepository.create({
            recipientUserId: user.id,
            channel: NotificationChannel.IN_APP,
            notificationType: NotificationType.INFO,
            title: 'Message envoyé',
            content: `Votre message "${contactData.subject}" a bien été envoyé à l'équipe COPA.`,
            context: {
              type: 'contact_in_app',
              contactId: savedSupportNotification.id,
            },
            isSent: true,
            sentAt: new Date(),
          });

          await this.notificationRepository.save(inAppNotification);
        } catch (inAppError) {
          this.logger.error('Erreur création notification in-app:', inAppError);
        }
      }

      this.logger.log(
        `✅ Notifications de contact envoyées avec succès pour ${contactData.email}`,
      );

      return {
        success: true,
        supportNotificationId: savedSupportNotification.id,
        userNotificationId: savedUserNotification?.id,
      };
    } catch (error) {
      this.logger.error(
        "❌ Erreur lors de l'envoi des notifications de contact:",
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envoie un email de bienvenue après inscription
   */
  async sendWelcomeEmail(options: {
    to: string;
    template?: string;
    data: {
      firstName: string;
      loginUrl: string;
      activationLink: string;
      verificationToken: string;
    };
  }): Promise<any> {
    try {
      this.logger.log(`Préparation email de bienvenue pour ${options.to}`);

      // Récupérer le template d'email
      const template = this.emailTemplates.getConfirmationInscription({
        firstName: options.data.firstName,
        activationLink: options.data.activationLink,
      });

      // Envoyer l'email via le provider configuré (SES ou Brevo)
      const result = await this.twilioService.sendEmail({
        to: options.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      // Sauvegarder la notification en base de données
      const user = await this.usersService.findByEmail(options.to);

      if (user) {
        const notification = this.notificationRepository.create({
          recipientUserId: user.id,
          channel: NotificationChannel.EMAIL,
          notificationType: NotificationType.CONFIRMATION,
          title: template.subject,
          content: template.text,
          context: {
            verificationToken: options.data.verificationToken,
            emailType: 'welcome',
            messageId: result.messageId,
          },
          isSent: true,
          sentAt: new Date(),
        });

        await this.notificationRepository.save(notification);
      }

      this.logger.log(`Email de bienvenue envoyé avec succès à ${options.to}`);

      return {
        success: true,
        messageId: result.messageId,
        provider: result.provider || 'unknown',
      };
    } catch (error) {
      this.logger.error(`Erreur envoi email bienvenue à ${options.to}:`, error);

      // En cas d'échec, on peut quand même sauvegarder une notification en échec
      try {
        const user = await this.usersService.findByEmail(options.to);
        if (user) {
          const notification = this.notificationRepository.create({
            recipientUserId: user.id,
            channel: NotificationChannel.EMAIL,
            notificationType: NotificationType.CONFIRMATION,
            title: 'Bienvenue sur COPA',
            content: 'Email de bienvenue (en attente)',
            context: {
              error: error.message,
              emailType: 'welcome',
            },
            isSent: false,
          });
          await this.notificationRepository.save(notification);
        }
      } catch (saveError) {
        this.logger.error(
          'Impossible de sauvegarder la notification en échec:',
          saveError,
        );
      }

      // Ne pas bloquer l'inscription si l'email échoue
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envoie un email de confirmation d'enregistrement de profil entrepreneur
   * @param options - Les options pour l'envoi de l'email
   * @returns Promise avec le résultat de l'envoi
   */
  async sendConfirmationProfilEnregistre(options: {
    user: any;
    datePreselection?: string;
    dateFormation?: string;
    dateResultatsPreselection?: string;
    customMessage?: string;
  }): Promise<any> {
    try {
      const {
        user,
        datePreselection,
        dateFormation,
        dateResultatsPreselection,
        customMessage,
      } = options;

      // Vérification que l'utilisateur existe
      if (!user || !user.email) {
        throw new BadRequestException('Utilisateur ou email manquant');
      }

      this.logger.log(
        `Préparation email confirmation profil pour ${user.email}`,
      );

      // Générer les dates par défaut si non fournies
      const currentYear = new Date().getFullYear();
      const defaultPreselection = '15 - 30 avril ' + currentYear;
      const defaultFormation = '10 - 25 mai ' + currentYear;
      const defaultResultats = '30 avril ' + currentYear;

      // Récupérer le template depuis EmailTemplatesService
      const template = this.emailTemplates.getConfirmationProfilEnregistre({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        telephone: user.phoneNumber || '',
        code: user.code || '',
        dateEnregistrement: this.emailTemplates.formatDate(new Date()),
        datePreselection: datePreselection || defaultPreselection,
        dateFormation: dateFormation || defaultFormation,
        dateResultatsPreselection:
          dateResultatsPreselection || defaultResultats,
        dateSoumissionPlan: 'Juin ' + currentYear,
        annee: currentYear.toString(),
        // messagePersonnalise: customMessage || '',
      });

      // Envoyer l'email via Twilio (ou SendGrid/Brevo)
      const result = await this.twilioService.sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: [], // Si vous voulez joindre un fichier
      });

      // Sauvegarder la notification en base de données
      const notification = this.notificationRepository.create({
        recipientUserId: user.id,
        channel: NotificationChannel.EMAIL,
        notificationType: NotificationType.CONFIRMATION,
        title: template.subject,
        content: template.text,
        context: {
          emailType: 'confirmation_profil',
          dateEnregistrement: new Date(),
          datePreselection: datePreselection || defaultPreselection,
          dateResultats: dateResultatsPreselection || defaultResultats,
          messageId: result.messageId,
          provider: result.provider || 'unknown',
          customMessage: customMessage || null,
        },
        // metadata: {
        //   userAgent: options.user.userAgent, // Si vous voulez tracker
        //   ipAddress: options.user.ipAddress,
        // },
        isSent: true,
        sentAt: new Date(),
        isRead: false,
      });

      await this.notificationRepository.save(notification);

      this.logger.log(
        `✅ Email confirmation profil envoyé avec succès à ${user.email} - Notification #${notification.id}`,
      );

      // Envoyer également un SMS de confirmation (optionnel)
      try {
        if (user.phoneNumber) {
          const smsContent = `COPA: Votre profil entrepreneur est enregistré! Résultats pré-sélection: ${dateResultatsPreselection || defaultResultats}. Suivez votre dossier sur votre espace personnel.`;

          await this.twilioService.sendSms(user.phoneNumber, smsContent);

          this.logger.log(`SMS de confirmation envoyé à ${user.phoneNumber}`);
        }
      } catch (smsError) {
        // Ne pas bloquer le processus si le SMS échoue
        this.logger.warn(`Échec envoi SMS à ${user.phoneNumber}:`, smsError);
      }

      return {
        success: true,
        messageId: result.messageId,
        notificationId: notification.id,
        provider: result.provider || 'unknown',
        timestamp: new Date(),
        email: user.email,
        smsEnvoye: !!user.phoneNumber,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur envoi email confirmation profil à ${options.user?.email}:`,
        error,
      );

      // Sauvegarder l'échec en base de données
      try {
        if (options.user && options.user.id) {
          const failedNotification = this.notificationRepository.create({
            recipientUserId: options.user.id,
            channel: NotificationChannel.EMAIL,
            notificationType: NotificationType.CONFIRMATION,
            title: 'Confirmation de votre profil entrepreneur',
            content: 'Email de confirmation (en attente)',
            context: {
              emailType: 'confirmation_profil',
              error: error.message,
              errorStack: error.stack,
              dateTentative: new Date(),
            },
            isSent: false,
            // metadata: {
            //   errorCode: error.code || 'UNKNOWN_ERROR',
            // },
          });
          await this.notificationRepository.save(failedNotification);
        }
      } catch (saveError) {
        this.logger.error(
          'Impossible de sauvegarder la notification en échec:',
          saveError,
        );
      }

      // Option 1: Relancer l'erreur (bloque le processus)
      // throw new InternalServerErrorException(`Échec envoi email: ${error.message}`);

      // Option 2: Retourner un objet d'échec (ne bloque pas)
      return {
        success: false,
        error: error.message,
        email: options.user?.email,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(options: {
    to: string;
    template?: string;
    data: {
      firstName: string;
      resetLink: string;
      expiresIn: string;
      supportEmail: string;
    };
  }): Promise<any> {
    try {
      this.logger.log(`Préparation email reset password pour ${options.to}`);

      // Récupérer le template
      const template = this.emailTemplates.getPasswordReset({
        firstName: options.data.firstName,
        resetLink: options.data.resetLink,
        expiresIn: options.data.expiresIn,
        supportEmail: options.data.supportEmail,
      });

      // Envoyer l'email
      const result = await this.twilioService.sendEmail({
        to: options.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateId:
          options.template === 'password-reset'
            ? this.configService.get('SENDGRID_TEMPLATE_PASSWORD_RESET')
            : undefined,
      });

      // Sauvegarder en base
      const user = await this.usersService.findByEmail(options.to);
      if (user) {
        const notification = this.notificationRepository.create({
          recipientUserId: user.id,
          channel: NotificationChannel.EMAIL,
          notificationType: NotificationType.INFO,
          title: template.subject,
          content: template.text,
          context: {
            emailType: 'password_reset',
            resetLink: options.data.resetLink,
            messageId: result.messageId,
            provider: result.provider,
          },
          isSent: true,
          sentAt: new Date(),
        });
        await this.notificationRepository.save(notification);
      }

      this.logger.log(`✅ Email reset password envoyé à ${options.to}`);

      return {
        success: true,
        messageId: result.messageId,
        provider: result.provider,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur envoi reset password à ${options.to}:`,
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envoie une notification de changement de mot de passe
   */
  async sendPasswordChangedEmail(options: {
    to: string;
    template?: string;
    data: {
      firstName: string;
      changeTime: string;
      ipAddress: string;
      supportEmail: string;
    };
  }): Promise<any> {
    try {
      const template = this.emailTemplates.getPasswordChanged({
        firstName: options.data.firstName,
        changeTime: options.data.changeTime,
        ipAddress: options.data.ipAddress,
        supportEmail: options.data.supportEmail,
      });

      const result = await this.twilioService.sendEmail({
        to: options.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      const user = await this.usersService.findByEmail(options.to);
      if (user) {
        const notification = this.notificationRepository.create({
          recipientUserId: user.id,
          channel: NotificationChannel.EMAIL,
          notificationType: NotificationType.INFO,
          title: template.subject,
          content: template.text,
          context: {
            emailType: 'password_changed',
            changeTime: options.data.changeTime,
            ipAddress: options.data.ipAddress,
            messageId: result.messageId,
          },
          isSent: true,
          sentAt: new Date(),
        });
        await this.notificationRepository.save(notification);
      }

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(
        'Erreur envoi notification changement password:',
        error,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Journalise une tentative de réinitialisation de mot de passe
   */
  async logPasswordReset(data: {
    userId: number;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      // Créer une notification système pour l'audit
      const notification = this.notificationRepository.create({
        recipientUserId: data.userId,
        channel: NotificationChannel.IN_APP,
        notificationType: NotificationType.INFO,
        title: 'Réinitialisation de mot de passe',
        content: 'Votre mot de passe a été réinitialisé avec succès',
        context: {
          eventType: 'password_reset',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: data.timestamp,
          action: 'reset_completed',
        },
        isSent: true,
        sentAt: data.timestamp,
        isRead: false,
      });

      await this.notificationRepository.save(notification);

      this.logger.log(`Password reset logged for user ${data.userId}`);
    } catch (error) {
      this.logger.error('Erreur lors du log password reset:', error);
    }
  }

  async sendPlanSoumis(user: any, plan: any) {
    const template = this.emailTemplates.getPlanAffairesSoumis({
      firstName: user.firstName,
      dossierNumero: plan.numero,
      secteur: plan.secteur,
      montantDemande: this.emailTemplates.formatMontant(plan.montant),
      dateResultats: this.emailTemplates.formatDate(plan.dateResultats),
    });

    return this.twilioService.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendLaureatSms(user: any, subvention: any) {
    const sms = this.emailTemplates.getSms(SmsTemplateType.LAUREAT, {
      montantSubvention: this.emailTemplates.formatMontant(subvention.montant),
    });

    return this.twilioService.sendSms(user.phoneNumber, sms);
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
    const user = await this.usersService.findById(
      notification.recipientUserId || 0,
    );

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

  async testBrevo(data: {
    to: string;
    subject?: string;
    message?: string;
  }): Promise<any> {
    // Test simple
    const result = await this.twilioService.sendEmail({
      to: data.to,
      subject: data.subject || 'Test Brevo',
      html: data.message || '<h1>Test</h1><p>Email via Brevo</p>',
    });

    // Vérification de la configuration
    const isValid = await this.twilioService.validateBrevoConfig();
    const templates = await this.twilioService.listBrevoTemplates();

    return {
      emailSent: result,
      configValid: isValid,
      availableTemplates: templates,
      activeProvider: this.twilioService['activeEmailProvider'],
    };
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

  private generateVerificationToken(): string {
    // Génère un token aléatoire de 32 caractères hexadécimaux
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}
