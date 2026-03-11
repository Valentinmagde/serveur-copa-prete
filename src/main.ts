import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Static files for uploads
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('COPA PRETE Platform API')
    .setDescription('API documentation for COPA PRETE Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('beneficiaries', 'Beneficiary management')
    .addTag('companies', 'Company management')
    .addTag('business-plans', 'Business plan management')
    .addTag('evaluations', 'Evaluation management')
    .addTag('training', 'Training management')
    .addTag('subventions', 'Subvention management')
    .addTag('complaints', 'Complaint management')
    .addTag('monitoring', 'Monitoring and indicators')
    .addTag('notifications', 'Notification management')
    .addTag('documents', 'Document management')
    .addTag('reference', 'Reference data')
    .addTag('admin', 'Administration')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
