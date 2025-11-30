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
import { User } from '../src/users/entities/user.entity';
import { Thread } from '../src/threads/entities/thread.entity';
import { Chat } from '../src/chats/entities/chat.entity';
import { Feedback } from '../src/feedbacks/entities/feedback.entity';

describe('ChatsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;

  const testUser = {
    email: 'chattest@example.com',
    password: 'password123',
    name: '채팅테스트유저',
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
            limit: 30,
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
    } catch (e) {
      // ignore
    }

    // 회원가입
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(testUser)
      .expect(201);

    // 로그인
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const tokenData = loginResponse.body.data.data || loginResponse.body.data;
    accessToken = tokenData.accessToken;

    // userId 추출
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    );
    userId = payload.sub;
  }, 30000);

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      try {
        // 관련 데이터 정리 (cascade로 자동 삭제됨)
        await dataSource.getRepository(User).delete({ email: testUser.email });
      } catch (e) {
        // ignore
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /chats', () => {
    it('채팅 메시지 전송 성공 (Mock AI 응답)', async () => {
      const response = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '안녕하세요, 테스트 질문입니다.',
        })
        .expect(201);

      expect(response.body).toHaveProperty('threadId');
      expect(response.body).toHaveProperty('chat');
      expect(response.body.chat).toHaveProperty('id');
      expect(response.body.chat).toHaveProperty('question', '안녕하세요, 테스트 질문입니다.');
      expect(response.body.chat).toHaveProperty('answer');
      // Mock AI 응답 확인
      expect(response.body.chat.answer).toContain('[Mock]');
    });

    it('인증 없이 요청 시 401 에러', async () => {
      await request(app.getHttpServer())
        .post('/chats')
        .send({
          question: '테스트 질문',
        })
        .expect(401);
    });

    it('질문 없이 요청 시 400 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('질문은 필수 항목입니다.');
    });

    it('스트리밍 모드로 채팅 전송', async () => {
      const response = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '스트리밍 테스트 질문입니다.',
          isStreaming: true,
        });

      // SSE 응답 확인 (supertest는 스트림 완료 후 응답 반환)
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.text).toContain('event:');
      expect(response.text).toContain('data:');
    });
  });

  describe('GET /chats/thread/:threadId', () => {
    let threadId: string;

    beforeAll(async () => {
      // 채팅 생성하여 스레드 ID 획득
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '스레드 테스트용 질문입니다.',
        });

      threadId = chatResponse.body.threadId;
    });

    it('스레드의 채팅 목록 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/chats/thread/${threadId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('question');
      expect(response.body.data[0]).toHaveProperty('answer');
    });

    it('인증 없이 조회 시 401 에러', async () => {
      await request(app.getHttpServer())
        .get(`/chats/thread/${threadId}`)
        .expect(401);
    });

    it('존재하지 않는 스레드 조회 시 403 또는 404 에러', async () => {
      const fakeThreadId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .get(`/chats/thread/${fakeThreadId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });
});
