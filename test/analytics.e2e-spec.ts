import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { ChatsModule } from '../src/chats/chats.module';
import { ThreadsModule } from '../src/threads/threads.module';
import { FeedbacksModule } from '../src/feedbacks/feedbacks.module';
import { AnalyticsModule } from '../src/analytics/analytics.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Thread } from '../src/threads/entities/thread.entity';
import { Chat } from '../src/chats/entities/chat.entity';
import { Feedback } from '../src/feedbacks/entities/feedback.entity';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let adminAccessToken: string;

  const testUser = {
    email: 'analyticstest@example.com',
    password: 'password123',
    name: '분석테스트유저',
  };

  const adminUser = {
    email: 'analyticsadmin@example.com',
    password: 'password123',
    name: '관리자',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 100,
          },
        ]),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'user',
          password: 'password',
          database: 'ai_db',
          entities: [User, Thread, Chat, Feedback],
          synchronize: true,
          dropSchema: false,
        }),
        AuthModule,
        UsersModule,
        ThreadsModule,
        ChatsModule,
        FeedbacksModule,
        AnalyticsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const { TransformInterceptor } = await import(
      '../src/common/interceptors/transform.interceptor'
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // 테스트 유저 정리 후 생성
    try {
      await dataSource.getRepository(User).delete({ email: testUser.email });
      await dataSource.getRepository(User).delete({ email: adminUser.email });
    } catch (e) {
      // ignore
    }

    // 일반 유저 회원가입 및 로그인
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(testUser)
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const tokenData = loginResponse.body.data.data || loginResponse.body.data;
    accessToken = tokenData.accessToken;

    // 관리자 생성
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(adminUser)
      .expect(201);

    await dataSource
      .getRepository(User)
      .update({ email: adminUser.email }, { role: UserRole.ADMIN });

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password,
      });

    const adminTokenData =
      adminLoginResponse.body.data.data || adminLoginResponse.body.data;
    adminAccessToken = adminTokenData.accessToken;

    // 테스트 데이터 생성 (채팅)
    await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        question: '분석 테스트용 질문입니다.',
      });
  }, 30000);

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      try {
        await dataSource.getRepository(User).delete({ email: testUser.email });
        await dataSource.getRepository(User).delete({ email: adminUser.email });
      } catch (e) {
        // ignore
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('GET /analytics/activity-report (관리자)', () => {
    it('관리자: 활동 리포트 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/activity-report')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('signupCount');
      expect(response.body.data).toHaveProperty('loginCount');
      expect(response.body.data).toHaveProperty('chatCount');
    });

    it('일반 유저: 권한 없음 403 에러', async () => {
      await request(app.getHttpServer())
        .get('/analytics/activity-report')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('인증 없이 요청 시 401 에러', async () => {
      await request(app.getHttpServer())
        .get('/analytics/activity-report')
        .expect(401);
    });
  });

  describe('GET /analytics/chat-report (관리자)', () => {
    it('관리자: CSV 다운로드 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/chat-report')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain(
        'attachment; filename="chat-report.csv"',
      );
      // CSV 내용이 있는지 확인
      expect(response.text).toBeDefined();
    });

    it('일반 유저: 권한 없음 403 에러', async () => {
      await request(app.getHttpServer())
        .get('/analytics/chat-report')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('인증 없이 요청 시 401 에러', async () => {
      await request(app.getHttpServer())
        .get('/analytics/chat-report')
        .expect(401);
    });
  });
});
