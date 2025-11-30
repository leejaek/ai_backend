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
import { User, UserRole } from '../src/users/entities/user.entity';
import { Thread } from '../src/threads/entities/thread.entity';
import { Chat } from '../src/chats/entities/chat.entity';
import { Feedback } from '../src/feedbacks/entities/feedback.entity';

describe('FeedbacksController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let adminAccessToken: string;
  let chatId: string;

  const testUser = {
    email: 'feedbacktest@example.com',
    password: 'password123',
    name: '피드백테스트유저',
  };

  const adminUser = {
    email: 'feedbackadmin@example.com',
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

    // 채팅 생성 (피드백 대상)
    const chatResponse = await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        question: '피드백 테스트용 질문입니다.',
      });

    chatId = chatResponse.body.chat.id;
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

  describe('POST /feedbacks', () => {
    it('피드백 생성 성공 (긍정)', async () => {
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '피드백 긍정 테스트용 질문입니다.',
        });

      const testChatId = chatResponse.body.chat.id;

      const response = await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: testChatId,
          isPositive: true,
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('chatId', testChatId);
      expect(response.body.data).toHaveProperty('isPositive', true);
      expect(response.body.data).toHaveProperty('status', 'pending');
    }, 30000);

    it('피드백 생성 성공 (부정)', async () => {
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '피드백 부정 테스트용 질문입니다.',
        });

      const testChatId = chatResponse.body.chat.id;

      const response = await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: testChatId,
          isPositive: false,
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('isPositive', false);
    }, 30000);

    it('동일 채팅에 중복 피드백 시 409 에러', async () => {
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '피드백 중복 테스트용 질문입니다.',
        });

      const testChatId = chatResponse.body.chat.id;

      // 먼저 피드백 생성
      await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: testChatId,
          isPositive: true,
        })
        .expect(201);

      // 중복 피드백 시도
      await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: testChatId,
          isPositive: false,
        })
        .expect(409);
    }, 30000);

    it('존재하지 않는 채팅에 피드백 시 404 에러', async () => {
      const fakeChatId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: fakeChatId,
          isPositive: true,
        })
        .expect(404);
    });

    it('필수 필드 누락 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: chatId,
        })
        .expect(400);
    });

    it('인증 없이 요청 시 401 에러', async () => {
      await request(app.getHttpServer())
        .post('/feedbacks')
        .send({
          chatId: chatId,
          isPositive: true,
        })
        .expect(401);
    });
  });

  describe('GET /feedbacks', () => {
    it('내 피드백 목록 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('페이지네이션 파라미터 적용', async () => {
      const response = await request(app.getHttpServer())
        .get('/feedbacks?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(5);
    });

    it('인증 없이 요청 시 401 에러', async () => {
      await request(app.getHttpServer()).get('/feedbacks').expect(401);
    });
  });

  describe('GET /feedbacks/all (관리자)', () => {
    it('관리자: 전체 피드백 목록 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/feedbacks/all')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });

    it('일반 유저: 권한 없음 403 에러', async () => {
      await request(app.getHttpServer())
        .get('/feedbacks/all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('PATCH /feedbacks/:id/status (관리자)', () => {
    it('관리자: 피드백 상태 변경 성공', async () => {
      // 새 채팅 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '상태 변경 성공 테스트용 질문입니다.',
        });

      const newChatId = chatResponse.body.chat.id;

      // 피드백 생성
      const feedbackResponse = await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: newChatId,
          isPositive: false,
        });

      const feedbackId = feedbackResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .patch(`/feedbacks/${feedbackId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          status: 'resolved',
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('status', 'resolved');
    }, 30000);

    it('일반 유저: 권한 없음 403 에러', async () => {
      // 새 채팅 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '권한 테스트용 질문입니다.',
        });

      const newChatId = chatResponse.body.chat.id;

      // 피드백 생성
      const feedbackResponse = await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: newChatId,
          isPositive: false,
        });

      const feedbackId = feedbackResponse.body.data.id;

      await request(app.getHttpServer())
        .patch(`/feedbacks/${feedbackId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'resolved',
        })
        .expect(403);
    }, 30000);

    it('존재하지 않는 피드백 상태 변경 시 404 에러', async () => {
      const fakeFeedbackId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .patch(`/feedbacks/${fakeFeedbackId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          status: 'resolved',
        })
        .expect(404);
    });

    it('잘못된 상태값 전송 시 400 에러', async () => {
      // 새 채팅 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '잘못된 상태 테스트용 질문입니다.',
        });

      const newChatId = chatResponse.body.chat.id;

      // 피드백 생성
      const feedbackResponse = await request(app.getHttpServer())
        .post('/feedbacks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatId: newChatId,
          isPositive: false,
        });

      const feedbackId = feedbackResponse.body.data.id;

      await request(app.getHttpServer())
        .patch(`/feedbacks/${feedbackId}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          status: 'invalid_status',
        })
        .expect(400);
    }, 30000);
  });
});
