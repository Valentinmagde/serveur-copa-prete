import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { SesEmailProvider } from './providers/ses-email.provider';
import { BrevoProvider } from './providers/brevo-provider';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private twilioClient: any;
  private activeEmailProvider: 'ses' | 'brevo' | 'simulation';

  constructor(
    private configService: ConfigService,
    private sesProvider: SesEmailProvider,
    private brevoProvider: BrevoProvider,
  ) {
    this.initTwilio();
    this.determineEmailProvider();
  }

  private determineEmailProvider() {
    // Priorité: Brevo (si configuré) > SES > Simulation
    if (this.configService.get('BREVO_API_KEY')) {
      this.activeEmailProvider = 'brevo';
      this.logger.log('Using Brevo as email provider');
    } else if (this.configService.get('AWS_ACCESS_KEY_ID')) {
      this.activeEmailProvider = 'ses';
      this.logger.log('Using SES as email provider');
    } else {
      this.activeEmailProvider = 'simulation';
      this.logger.warn('No email provider configured - using simulation mode');
    }
  }

  private initTwilio() {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials not configured');
      return;
    }

    this.twilioClient = twilio(accountSid, authToken);
  }

  // ==================== EMAIL METHODS ====================

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    templateId?: string | number; // string pour SES, number pour Brevo
    templateData?: any;
    attachments?: any[];
  }): Promise<any> {
    try {
      let result;

      switch (this.activeEmailProvider) {
        case 'brevo':
          // Conversion des paramètres pour Brevo
          result = await this.brevoProvider.sendEmail({
            to: this.formatBrevoRecipients(options.to),
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text,
            params: options.templateData,
            ...(typeof options.templateId === 'number' && {
              templateId: options.templateId,
            }),
          });
          break;

        case 'ses':
          // Votre code SES existant
          result = await this.sesProvider.sendEmail({
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            templateData: options.templateData,
          });
          break;

        default:
          // Simulation
          result = this.simulateEmail(options);
      }

      this.logger.log(`Email sent to ${options.to} via ${this.activeEmailProvider}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      
      // Fallback vers simulation en cas d'erreur
      this.logger.warn('Falling back to simulated email');
      return {
        simulated: true,
        to: options.to,
        subject: options.subject,
        error: error.message,
      };
    }
  }

  // ==================== MÉTHODES SPÉCIFIQUES BREVO ====================

  /**
   * Envoie un email via Brevo avec template
   */
  async sendBrevoTemplate(options: {
    to: string | { email: string; name?: string }[];
    templateId: number;
    params: Record<string, any>;
  }): Promise<any> {
    if (this.activeEmailProvider !== 'brevo') {
      this.logger.warn('Brevo not active - using simulation');
      return this.simulateEmail(options);
    }

    return this.brevoProvider.sendTemplateEmail({
      to: options.to,
      templateId: options.templateId,
      params: options.params,
    });
  }

  /**
   * Liste les templates Brevo disponibles
   */
  async listBrevoTemplates(): Promise<any[]> {
    if (this.activeEmailProvider !== 'brevo') {
      return [];
    }

    return this.brevoProvider.listTemplates();
  }

  /**
   * Vérifie la configuration Brevo
   */
  async validateBrevoConfig(): Promise<boolean> {
    return this.brevoProvider.validateApiKey();
  }

  // ==================== UTILITAIRES ====================

  private formatBrevoRecipients(to: string | string[]): { email: string }[] {
    if (Array.isArray(to)) {
      return to.map(email => ({ email }));
    }
    return [{ email: to }];
  }

  private simulateEmail(options: any): any {
    this.logger.warn('Email provider not configured - simulating email');
    this.logger.log(`[EMAIL SIMULATED] To: ${options.to}, Subject: ${options.subject}`);
    return {
      simulated: true,
      messageId: `simulated-${Date.now()}`,
      provider: 'simulation',
      ...options,
    };
  }

  // ==================== SMS & WHATSAPP (inchangés) ====================

  async sendSms(to: string, message: string): Promise<any> {
    // ... votre code SMS existant
  }

  async sendWhatsApp(to: string, message: string): Promise<any> {
    // ... votre code WhatsApp existant
  }

  private formatPhoneNumber(phone: string): string {
    // ... votre code existant
    return phone;
  }
}