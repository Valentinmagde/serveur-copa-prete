export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: any;
  attachments?: any[];
  from?: string; // Optionnel, pour override
}

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<any>;
  sendBulkEmail?(options: EmailOptions & { to: string[] }): Promise<any>;
  validateEmail?(email: string): Promise<boolean>;
}
