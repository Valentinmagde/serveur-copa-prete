import { registerAs } from '@nestjs/config';

export default registerAs('twilio', () => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
  sendgridFromName: process.env.SENDGRID_FROM_NAME,
  templates: {
    welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
    validation: process.env.SENDGRID_TEMPLATE_VALIDATION,
    reminder: process.env.SENDGRID_TEMPLATE_REMINDER,
  },
}));
