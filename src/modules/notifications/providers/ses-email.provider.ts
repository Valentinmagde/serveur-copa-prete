import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
  SendTemplatedEmailCommand,
} from '@aws-sdk/client-ses';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SesEmailProvider {
  private readonly logger = new Logger(SesEmailProvider.name);
  private sesClient: SESClient;
  private transporter: nodemailer.Transporter;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    try {
      const region = this.configService.get('AWS_REGION') || 'eu-west-3';
      const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');

      if (!accessKeyId || !secretAccessKey) {
        this.logger.warn(
          'AWS SES credentials not configured - using simulation mode',
        );
        return;
      }

      // Initialiser le client SES
      this.sesClient = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      // Configuration correcte pour Nodemailer avec SES
      this.transporter = nodemailer.createTransport({
        host: `email.${region}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: accessKeyId,
          pass: secretAccessKey,
        },
        requireTLS: true,
      });

      this.isConfigured = true;
      this.logger.log('AWS SES initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AWS SES:', error);
    }
  }

  /**
   * Envoie un email via SES
   */
  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    fromName?: string;
    attachments?: any[];
    templateData?: any;
  }): Promise<any> {
    if (!this.isConfigured) {
      return this.simulateEmail(options);
    }

    const fromEmail =
      options.from ||
      this.configService.get('AWS_SES_FROM') ||
      'no-reply@copa-prete.bi';
    const fromName =
      options.fromName ||
      this.configService.get('AWS_SES_FROM_NAME') ||
      'Copa Prete';

    // Utilisation de l'API SES directement pour plus de fiabilité
    const params = {
      Source: `"${fromName}" <${fromEmail}>`,
      Destination: {
        ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: options.html || '',
            Charset: 'UTF-8',
          },
          Text: {
            Data: options.text || this.stripHtml(options.html || ''),
            Charset: 'UTF-8',
          },
        },
      },
    };

    // Ajouter les pièces jointes si nécessaire (via SendRawEmailCommand pour les cas complexes)
    if (options.attachments && options.attachments.length > 0) {
      // Pour les pièces jointes, utiliser nodemailer
      return this.sendEmailWithAttachments(options);
    }

    try {
      const command = new SendEmailCommand(params);
      const result = await this.sesClient.send(command);
      this.logger.log(
        `Email sent via SES to ${options.to}, MessageId: ${result.MessageId}`,
      );

      return {
        messageId: result.MessageId,
        provider: 'SES',
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to send email via SES: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envoie un email avec pièces jointes via Nodemailer
   */
  private async sendEmailWithAttachments(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    fromName?: string;
    attachments?: any[];
  }): Promise<any> {
    const fromEmail =
      options.from ||
      this.configService.get('AWS_SES_FROM') ||
      'no-reply@copa-prete.bi';
    const fromName =
      options.fromName ||
      this.configService.get('AWS_SES_FROM_NAME') ||
      'Copa Prete';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || this.stripHtml(options.html || ''),
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      return {
        messageId: result.messageId,
        provider: 'SES',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email with attachments: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envoie un email avec template SES (corrigé)
   */
  async sendTemplateEmail(options: {
    to: string | string[];
    templateId: string;
    templateData: any;
    from?: string;
    fromName?: string;
  }): Promise<any> {
    if (!this.isConfigured) {
      return this.simulateEmail({ to: options.to, subject: 'Template Email' });
    }

    const fromEmail =
      options.from ||
      this.configService.get('AWS_SES_FROM') ||
      'no-reply@copa-prete.bi';
    const fromName =
      options.fromName ||
      this.configService.get('AWS_SES_FROM_NAME') ||
      'Copa Prete';

    // Utilisation correcte de SendTemplatedEmailCommand
    const params = {
      Source: `"${fromName}" <${fromEmail}>`,
      Destination: {
        ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
      },
      Template: options.templateId,
      TemplateData: JSON.stringify(options.templateData),
    };

    try {
      const command = new SendTemplatedEmailCommand(params);
      const result = await this.sesClient.send(command);

      this.logger.log(
        `Template email sent via SES to ${options.to}, MessageId: ${result.MessageId}`,
      );
      return {
        messageId: result.MessageId,
        provider: 'SES',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send template email via SES: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Alternative: Utilisation de nodemailer-ses-transport (solution de secours)
   */
  private createNodemailerTransportWithSES() {
    // Si vous préférez utiliser nodemailer-ses-transport
    // npm install nodemailer-ses-transport
    const sesTransport = require('nodemailer-ses-transport');
    return nodemailer.createTransport(
      sesTransport({
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        region: this.configService.get('AWS_REGION') || 'eu-west-3',
      }),
    );
  }

  private simulateEmail(options: any): any {
    this.logger.warn('SES not configured - simulating email');
    this.logger.log(
      `[EMAIL SIMULATED] To: ${options.to}, Subject: ${options.subject}`,
    );
    return {
      simulated: true,
      messageId: `simulated-${Date.now()}`,
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
