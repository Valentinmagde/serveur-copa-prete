import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

// Configuration
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import awsConfig from './config/aws.config';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BeneficiariesModule } from './modules/beneficiaries/beneficiaries.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { BusinessPlansModule } from './modules/business-plans/business-plans.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { TrainingModule } from './modules/training/training.module';
import { SubventionsModule } from './modules/subventions/subventions.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { AdminModule } from './modules/admin/admin.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, awsConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        autoLoadEntities: true,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          statement_timeout: 30000,
          query_timeout: 30000,
        },
        // ✅ Timeout global
        connectTimeoutMS: 10000,
        // ✅ Logs pour debug
        logging: ['error', 'warn'],
        logger: 'advanced-console',
      }),
      inject: [ConfigService],
    }),

    // Rate Limiting - Fixed configuration
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 100,
        },
      ],
    }),

    // Redis Cache
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        options: {
          host: configService.get('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),

    // Application Modules
    AuthModule,
    UsersModule,
    BeneficiariesModule,
    CompaniesModule,
    BusinessPlansModule,
    EvaluationsModule,
    TrainingModule,
    SubventionsModule,
    ComplaintsModule,
    MonitoringModule,
    NotificationsModule,
    DocumentsModule,
    ReferenceModule,
    AdminModule,
    DashboardModule,
  ],
})
export class AppModule {}
