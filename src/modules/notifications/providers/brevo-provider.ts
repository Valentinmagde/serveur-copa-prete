import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from 'sib-api-v3-sdk';

@Injectable()
export class BrevoProvider {
  private readonly logger = new Logger(BrevoProvider.name);
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    try {
      const apiKey = this.configService.get('BREVO_API_KEY');

      if (!apiKey) {
        this.logger.warn(
          'Brevo API key not configured - using simulation mode',
        );
        return;
      }

      // Configuration selon la documentation officielle
      const defaultClient = SibApiV3Sdk.ApiClient.instance;

      // Configurer la clé API
      const apiKeyAuth = defaultClient.authentications['api-key'];
      apiKeyAuth.apiKey = apiKey;

      // Créer l'instance API pour les emails transactionnels
      this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

      this.isConfigured = true;
      this.logger.log('Brevo client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Brevo client:', error);
    }
  }

  /**
   * Envoie un email transactionnel via Brevo
   */
  async sendEmail(options: {
    to: string | { email: string; name?: string }[];
    subject: string;
    htmlContent?: string;
    textContent?: string;
    from?: string;
    fromName?: string;
    replyTo?: string;
    attachments?: Array<{
      name: string;
      content: string; // Base64 encoded content
      type?: string;
    }>;
    tags?: string[];
    params?: Record<string, any>;
    templateId?: number;
  }): Promise<any> {
    if (!this.isConfigured) {
      return this.simulateEmail(options);
    }

    try {
      // Créer l'objet d'envoi d'email selon la doc
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      // Formater les destinataires
      const to = Array.isArray(options.to)
        ? options.to.map((recipient) => {
            if (typeof recipient === 'string') {
              return { email: recipient };
            }
            return recipient;
          })
        : [{ email: options.to as string }];

      sendSmtpEmail.to = to;

      // Définir le sujet
      sendSmtpEmail.subject = options.subject;

      // Configurer l'expéditeur
      sendSmtpEmail.sender = {
        email:
          options.from ||
          this.configService.get('BREVO_SENDER_EMAIL') ||
          'no-reply@copa-prete.bi',
        name:
          options.fromName ||
          this.configService.get('BREVO_SENDER_NAME') ||
          'Copa Prete',
      };

      // Ajouter le contenu (HTML ou template)
      if (options.templateId) {
        sendSmtpEmail.templateId = options.templateId;
        sendSmtpEmail.params = options.params || {};
      } else {
        sendSmtpEmail.htmlContent = options.htmlContent || '';
        sendSmtpEmail.textContent =
          options.textContent || this.stripHtml(options.htmlContent || '');
      }

      // Options optionnelles
      if (options.replyTo) {
        sendSmtpEmail.replyTo = { email: options.replyTo };
      }

      if (options.attachments && options.attachments.length > 0) {
        sendSmtpEmail.attachment = options.attachments.map((att) => ({
          name: att.name,
          content: att.content,
          contentType: att.type,
        }));
      }

      if (options.tags && options.tags.length > 0) {
        sendSmtpEmail.tags = options.tags;
      }

      // Headers optionnels
      sendSmtpEmail.headers = {
        'X-Mailer': 'NestJS-Brevo-Provider',
      };

      // Envoyer l'email
      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      this.logger.log(
        `Email sent via Brevo to ${JSON.stringify(to)}, MessageId: ${result.messageId}`,
      );

      return {
        messageId: result.messageId,
        provider: 'Brevo',
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to send email via Brevo: ${error.message}`);

      // Gestion améliorée des erreurs
      if (error.response && error.response.body) {
        this.logger.error(
          `Brevo API Error: ${JSON.stringify(error.response.body)}`,
        );
      }

      throw error;
    }
  }

  /**
   * Envoie un email avec template
   */
  async sendTemplateEmail(options: {
    to: string | { email: string; name?: string }[];
    templateId: number;
    params: Record<string, any>;
    from?: string;
    fromName?: string;
    replyTo?: string;
    tags?: string[];
  }): Promise<any> {
    return this.sendEmail({
      to: options.to,
      subject: '', // Sera remplacé par le template
      templateId: options.templateId,
      params: options.params,
      from: options.from,
      fromName: options.fromName,
      replyTo: options.replyTo,
      tags: options.tags,
    });
  }

  /**
   * Envoi en masse
   */
  async sendBulkEmail(options: {
    messages: Array<{
      to: { email: string; name?: string }[];
      subject: string;
      htmlContent?: string;
      templateId?: number;
      params?: Record<string, any>;
    }>;
  }): Promise<any> {
    if (!this.isConfigured) {
      this.logger.warn('Brevo not configured - simulating bulk email');
      return { simulated: true, messageCount: options.messages.length };
    }

    try {
      // Pour l'envoi en masse, on peut soit envoyer un par un
      // soit utiliser l'API batch si disponible
      const results: any[] = [];
      for (const message of options.messages) {
        const result = await this.sendEmail(message);
        results.push(result);
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to send bulk email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie la validité de la clé API
   */
  async validateApiKey(): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      // Tenter de récupérer les templates comme test
      const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();
      const result = await apiInstance.getEmailCampaigns();
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Récupère les templates disponibles
   */
  async listTemplates(): Promise<any[]> {
    if (!this.isConfigured) return [];

    try {
      const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();
      const response = await apiInstance.getEmailCampaigns();
      return response.campaigns || [];
    } catch (error) {
      this.logger.error('Failed to list templates:', error);
      return [];
    }
  }

  private simulateEmail(options: any): any {
    this.logger.warn('Brevo not configured - simulating email');
    this.logger.log(
      `[EMAIL SIMULATED] To: ${JSON.stringify(options.to)}, Subject: ${options.subject}`,
    );
    return {
      simulated: true,
      messageId: `brevo-simulated-${Date.now()}`,
      provider: 'simulation',
      ...options,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Vérifie si le service est configuré
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}
