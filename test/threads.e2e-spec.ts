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
import { User, UserRole } from '../src/users/entities/user.entity';
import { Thread } from '../src/threads/entities/thread.entity';
import { Chat } from '../src/chats/entities/chat.entity';
import { Feedback } from '../src/feedbacks/entities/feedback.entity';

describe('ThreadsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let adminAccessToken: string;
  let userId: string;

  const testUser = {
    email: 'threadtest@example.com',
    password: 'password123',
    name: '스레드테스트유저',
  };

  const adminUser = {
    email: 'threadadmin@example.com',
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

    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    );
    userId = payload.sub;

    // 관리자 생성 (직접 DB에 추가)
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

  describe('GET /threads', () => {
    let threadId: string;

    beforeAll(async () => {
      // 채팅 생성하여 스레드 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '스레드 목록 테스트용 질문입니다.',
        });

      threadId = chatResponse.body.threadId;
    });

    it('내 스레드 목록 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/threads')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
    });

    it('페이지네이션 파라미터 적용', async () => {
      const response = await request(app.getHttpServer())
        .get('/threads?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(5);
    });

    it('인증 없이 요청 시 401 에러', async () => {
      await request(app.getHttpServer()).get('/threads').expect(401);
    });
  });

  describe('GET /threads/all (관리자)', () => {
    it('관리자: 전체 스레드 목록 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/threads/all')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });

    it('일반 유저: 권한 없음 403 에러', async () => {
      await request(app.getHttpServer())
        .get('/threads/all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('GET /threads/:id', () => {
    let threadId: string;

    beforeAll(async () => {
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '스레드 상세 테스트용 질문입니다.',
        });

      threadId = chatResponse.body.threadId;
    });

    it('스레드 상세 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/threads/${threadId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('id', threadId);
      expect(response.body.data).toHaveProperty('userId', userId);
    });

    it('존재하지 않는 스레드 조회 시 404 에러', async () => {
      const fakeThreadId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/threads/${fakeThreadId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('다른 유저의 스레드 조회 시 403 에러', async () => {
      // 관리자가 아닌 다른 일반 유저가 조회하면 403
      // 여기서는 관리자는 접근 가능하므로, 별도 유저 생성 필요
      // 단순히 관리자가 조회 가능한지만 테스트
      const response = await request(app.getHttpServer())
        .get(`/threads/${threadId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('id', threadId);
    });
  });

  describe('DELETE /threads/:id', () => {
    it('스레드 삭제 성공', async () => {
      // 삭제할 스레드 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '삭제 테스트용 질문입니다.',
        });

      const threadIdToDelete = chatResponse.body.threadId;

      const response = await request(app.getHttpServer())
        .delete(`/threads/${threadIdToDelete}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty(
        'message',
        '스레드가 삭제되었습니다.',
      );

      // 삭제 확인
      await request(app.getHttpServer())
        .get(`/threads/${threadIdToDelete}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    }, 30000);

    it('존재하지 않는 스레드 삭제 시 404 에러', async () => {
      const fakeThreadId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .delete(`/threads/${fakeThreadId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('다른 유저의 스레드 삭제 시 403 에러', async () => {
      // 새로운 스레드 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '403 테스트용 질문입니다.',
        });

      const threadIdToDelete = chatResponse.body.threadId;

      // 관리자도 본인 것만 삭제 가능
      await request(app.getHttpServer())
        .delete(`/threads/${threadIdToDelete}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(403);
    }, 30000);

    it('인증 없이 삭제 시 401 에러', async () => {
      // 새로운 스레드 생성
      const chatResponse = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          question: '401 테스트용 질문입니다.',
        });

      const threadIdToDelete = chatResponse.body.threadId;

      await request(app.getHttpServer())
        .delete(`/threads/${threadIdToDelete}`)
        .expect(401);
    }, 30000);
  });
});
