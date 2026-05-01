import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Vonage } from '@vonage/server-sdk';

@Injectable()
export class NexmoProvider {
  private readonly logger = new Logger(NexmoProvider.name);
  private client: Vonage | null = null;
  private readonly from: string;

  // E.164: + suivi de 7 à 15 chiffres
  private readonly E164_REGEX = /^\+[1-9]\d{6,14}$/;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('NEXMO_API_KEY');
    const apiSecret = this.configService.get<string>('NEXMO_API_SECRET');
    this.from = this.configService.get<string>('NEXMO_FROM') ?? 'CopaPreté';

    if (apiKey && apiSecret) {
      this.client = new Vonage({ apiKey, apiSecret });
      this.logger.log('Nexmo (Vonage) SMS provider initialized');
    } else {
      this.logger.warn('Nexmo credentials not configured — SMS will be simulated');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) return phone;
    let cleaned = phone.replace(/[\s\-(). ]/g, '');
    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
    return cleaned;
  }

  async sendSms(to: string, message: string): Promise<{
    messageId: string;
    provider: string;
    status?: string;
    simulated?: boolean;
    error?: string;
  }> {
    const formatted = this.formatPhoneNumber(to);

    if (!this.E164_REGEX.test(formatted)) {
      this.logger.warn(`[SMS SKIPPED] Numéro invalide (non E.164): ${formatted}`);
      return {
        simulated: true,
        error: `Numéro invalide: ${formatted}`,
        messageId: `invalid-${Date.now()}`,
        provider: 'validation',
      };
    }

    if (!this.client) {
      this.logger.warn(`[SMS SIMULATED] To: ${formatted} | Message: ${message.slice(0, 50)}...`);
      return { simulated: true, messageId: `sms-sim-${Date.now()}`, provider: 'simulation' };
    }

    try {
      const response = await this.client.sms.send({
        to: formatted,
        from: this.from,
        text: message,
      });

      const msg = response.messages[0];

      if (msg.status !== '0') {
        this.logger.error(`Nexmo SMS error to ${formatted}: [${msg.status}] ${(msg as any)['error-text']}`);
        return {
          simulated: false,
          error: (msg as any)['error-text'] ?? `Status: ${msg.status}`,
          messageId: `nexmo-err-${Date.now()}`,
          provider: 'nexmo',
          status: msg.status,
        };
      }

      this.logger.log(`SMS envoyé via Nexmo à ${formatted} — ID: ${msg['message-id']}`);
      return {
        messageId: msg['message-id'],
        provider: 'nexmo',
        status: msg.status,
      };
    } catch (error: any) {
      this.logger.error(`Échec envoi SMS Nexmo à ${formatted}:`, error);
      return {
        simulated: true,
        error: error.message,
        messageId: `sms-failed-${Date.now()}`,
        provider: 'nexmo',
      };
    }
  }
}
