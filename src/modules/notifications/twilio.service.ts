import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import sgMail from '@sendgrid/mail';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private twilioClient: any;
  private sendgridClient: any;

  constructor(private configService: ConfigService) {
    this.initTwilio();
    this.initSendGrid();
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

  private initSendGrid() {
    const apiKey = this.configService.get('twilio.sendgridApiKey');

    if (!apiKey) {
      this.logger.warn('SendGrid API key not configured');
      return;
    }

    sgMail.setApiKey(apiKey);
    this.sendgridClient = sgMail;
  }

  // ==================== SMS METHODS ====================

  async sendSms(to: string, message: string): Promise<any> {
    try {
      if (!this.twilioClient) {
        this.logger.warn('Twilio not configured, simulating SMS');
        this.logger.log(`[SMS SIMULATED] To: ${to}, Message: ${message}`);
        return { simulated: true, to, message };
      }

      const from = this.configService.get('TWILIO_PHONE_NUMBER');

      const result = await this.twilioClient.messages.create({
        body: message,
        from,
        to: this.formatPhoneNumber(to),
      });

      this.logger.log(`SMS sent to ${to}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}:`, error);
      throw error;
    }
  }

  async sendBulkSms(recipients: string[], message: string): Promise<any[]> {
    const results: any[] = [];
    for (const to of recipients) {
      try {
        const result = await this.sendSms(to, message);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to send bulk SMS to ${to}:`, error);
        results.push({ to, error: error.message });
      }
    }
    return results;
  }

  async getSmsStatus(messageSid: string): Promise<any> {
    if (!this.twilioClient) {
      return { status: 'simulated' };
    }

    const message = await this.twilioClient.messages(messageSid).fetch();
    return message;
  }

  // ==================== EMAIL METHODS ====================

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    templateId?: string;
    templateData?: any;
    attachments?: any[];
  }): Promise<any> {
    try {
      const { to, subject, html, text, templateId, templateData, attachments } =
        options;

      if (!this.sendgridClient) {
        this.logger.warn('SendGrid not configured, simulating email');
        this.logger.log(`[EMAIL SIMULATED] To: ${to}, Subject: ${subject}`);
        return { simulated: true, to, subject };
      }

      const from = {
        email: this.configService.get('twilio.sendgridFromEmail'),
        name: this.configService.get('twilio.sendgridFromName'),
      };

      const msg: any = {
        to: Array.isArray(to) ? to : [to],
        from,
        subject,
      };

      if (templateId) {
        msg.templateId = templateId;
        msg.dynamicTemplateData = templateData;
      } else {
        msg.html = html;
        msg.text = text || this.stripHtml(html as any);
      }

      if (attachments) {
        msg.attachments = attachments;
      }

      const result = await this.sendgridClient.send(msg);
      this.logger.log(`Email sent to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  async sendBulkEmail(options: {
    to: string[];
    subject: string;
    html?: string;
    templateId?: string;
    templateData?: any[];
  }): Promise<any> {
    const { to, subject, html, templateId, templateData } = options;

    if (templateId && templateData && templateData.length === to.length) {
      // Envoi personnalisé avec templates
      const messages = to.map((recipient, index) => ({
        to: recipient,
        from: {
          email: this.configService.get('twilio.sendgridFromEmail'),
          name: this.configService.get('twilio.sendgridFromName'),
        },
        subject,
        templateId,
        dynamicTemplateData: templateData[index],
      }));

      return this.sendgridClient.send(messages);
    } else {
      // Même contenu pour tous
      return this.sendEmail({ to, subject, html, templateId, templateData });
    }
  }

  async sendTemplateEmail(
    to: string,
    templateName: string,
    data: any,
  ): Promise<any> {
    const templateId = this.configService.get(
      `twilio.templates.${templateName}`,
    );

    if (!templateId) {
      throw new Error(`Template ${templateName} not configured`);
    }

    return this.sendEmail({
      to,
      templateId,
      templateData: data,
      subject: '', // Sera remplacé par le template
    });
  }

  // ==================== WHATSAPP METHODS (via Twilio) ====================

  async sendWhatsApp(to: string, message: string): Promise<any> {
    try {
      if (!this.twilioClient) {
        this.logger.warn('Twilio not configured, simulating WhatsApp');
        this.logger.log(`[WHATSAPP SIMULATED] To: ${to}, Message: ${message}`);
        return { simulated: true };
      }

      const from = `whatsapp:${this.configService.get('twilio.phoneNumber')}`;
      const toWhatsApp = `whatsapp:${this.formatPhoneNumber(to)}`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from,
        to: toWhatsApp,
      });

      this.logger.log(`WhatsApp sent to ${to}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp to ${to}:`, error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  private formatPhoneNumber(phone: string): string {
    // Format international: +257XXXXXXXX
    if (!phone.startsWith('+')) {
      // Si c'est un numéro local burundais (79xxxxxx)
      if (phone.match(/^(79|76|75|72|71|77|78|73|74)\d{7}$/)) {
        return `+257${phone}`;
      }
      return `+${phone}`;
    }
    return phone;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async validatePhoneNumber(phone: string): Promise<boolean> {
    if (!this.twilioClient) {
      // Validation simple si Twilio non configuré
      return !!phone.match(/^\+?[0-9]{10,15}$/);
    }

    try {
      const formatted = this.formatPhoneNumber(phone);
      const result = await this.twilioClient.lookups
        .phoneNumbers(formatted)
        .fetch();
      return !!result;
    } catch (error) {
      this.logger.warn(`Invalid phone number ${phone}:`, error);
      return false;
    }
  }

  async validateEmail(email: string): Promise<boolean> {
    // Validation simple par regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }
}
