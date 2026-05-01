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
  private readonly E164_REGEX = /^\+[1-9]\d{6,14}$/;

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

      this.logger.log(`
        Email sent to ${options.to} via ${this.activeEmailProvider}
        Subject: ${options.subject}
        Message ID: ${result.messageId}
      `);
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

  // ==================== SMS ====================

  async sendSms(to: string, message: string): Promise<any> {
    const formatted = this.formatPhoneNumber(to);

    if (!this.E164_REGEX.test(formatted)) {
      this.logger.warn(`[SMS SKIPPED] Numéro invalide (non E.164): ${formatted}`);
      return { simulated: true, error: `Numéro invalide: ${formatted}`, messageId: `invalid-${Date.now()}`, provider: 'validation' };
    }

    if (!this.twilioClient) {
      this.logger.warn(`[SMS SIMULATED] To: ${formatted}`);
      return { simulated: true, messageId: `sms-sim-${Date.now()}`, provider: 'simulation' };
    }

    try {
      const from = this.configService.get<string>('TWILIO_SENDER_ID')
        || this.configService.get<string>('TWILIO_PHONE_NUMBER');
      const msg = await this.twilioClient.messages.create({ to: formatted, from, body: message });
      this.logger.log(`SMS sent to ${formatted}: ${msg.sid}`);
      return { messageId: msg.sid, provider: 'twilio', status: msg.status };
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${formatted}:`, error);
      return { simulated: true, error: error.message, messageId: `sms-failed-${Date.now()}`, provider: 'twilio' };
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<any> {
    const formatted = this.formatPhoneNumber(to);

    if (!this.twilioClient) {
      this.logger.warn(`[WHATSAPP SIMULATED] To: ${formatted}`);
      return { simulated: true, messageId: `wa-sim-${Date.now()}`, provider: 'simulation' };
    }

    try {
      const from = `whatsapp:${this.configService.get<string>('TWILIO_WHATSAPP_NUMBER')}`;
      const msg = await this.twilioClient.messages.create({ to: `whatsapp:${formatted}`, from, body: message });
      this.logger.log(`WhatsApp sent to ${formatted}: ${msg.sid}`);
      return { messageId: msg.sid, provider: 'twilio', status: msg.status };
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp to ${formatted}:`, error);
      return { simulated: true, error: error.message, messageId: `wa-failed-${Date.now()}`, provider: 'twilio' };
    }
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) return phone;
    let cleaned = phone.replace(/[\s\-(). ]/g, '');
    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
    return cleaned;
  }
}