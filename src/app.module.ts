import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import databaseConfig from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import { FeedbacksModule } from './feedbacks/feedbacks.module';
import { ThreadsModule } from './threads/threads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions =>
        configService.get<TypeOrmModuleOptions>('database')!,
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1분 (밀리초)
        limit: 30, // 30회
      },
    ]),
    AnalyticsModule,
    AuthModule,
    ChatsModule,
    FeedbacksModule,
    ThreadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
