import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testUser = {
    email: 'e2etest@example.com',
    password: 'password123',
    name: '테스트유저',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'user',
          password: 'password',
          database: 'ai_db',
          entities: [User],
          synchronize: true,
          dropSchema: false,
        }),
        AuthModule,
        UsersModule,
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

    // TransformInterceptor 추가 (main.ts와 동일하게)
    const { TransformInterceptor } = await import(
      '../src/common/interceptors/transform.interceptor'
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // 테스트 시작 전 기존 테스트 유저 삭제
    try {
      await dataSource
        .getRepository(User)
        .delete({ email: testUser.email });
    } catch (e) {
      // 테이블이 없으면 무시
    }
  }, 30000);

  afterAll(async () => {
    // 테스트 유저 정리
    if (dataSource && dataSource.isInitialized) {
      try {
        await dataSource
          .getRepository(User)
          .delete({ email: testUser.email });
      } catch (e) {
        // ignore
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /auth/signup', () => {
    afterEach(async () => {
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource
            .getRepository(User)
            .delete({ email: testUser.email });
        } catch (e) {
          // ignore
        }
      }
    });

    it('회원가입 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(201);

      expect(response.body.data).toHaveProperty('email', testUser.email);
      expect(response.body.data).toHaveProperty('name', testUser.name);
      expect(response.body.data).toHaveProperty('role', 'member');
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('id');
    });

    it('중복 이메일로 회원가입 시 409 에러', async () => {
      // 먼저 유저 생성
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(201);

      // 같은 이메일로 다시 가입 시도
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(409);

      expect(response.body.message).toBe('이미 등록된 이메일입니다.');
    });

    it('이메일 형식이 잘못된 경우 400 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: '테스트',
        })
        .expect(400);

      expect(response.body.message).toContain(
        '유효한 이메일 주소를 입력해주세요.',
      );
    });

    it('비밀번호가 6자 미만인 경우 400 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: '12345',
          name: '테스트',
        })
        .expect(400);

      expect(response.body.message).toContain(
        '비밀번호는 최소 6자 이상이어야 합니다.',
      );
    });

    it('필수 필드 누락 시 400 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('비밀번호는 필수 항목입니다.'),
          expect.stringContaining('이름은 필수 항목입니다.'),
        ]),
      );
    });
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      // 로그인 테스트 전 유저 정리 후 생성
      try {
        await dataSource
          .getRepository(User)
          .delete({ email: testUser.email });
      } catch (e) {
        // ignore
      }

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(201);
    });

    afterAll(async () => {
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource
            .getRepository(User)
            .delete({ email: testUser.email });
        } catch (e) {
          // ignore
        }
      }
    });

    it('로그인 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      // login 응답은 이미 { data: { accessToken } } 형식이므로
      // TransformInterceptor가 적용되면 { data: { data: { accessToken } } }
      const tokenData = response.body.data;
      expect(tokenData).toHaveProperty('accessToken');
      expect(typeof tokenData.accessToken).toBe('string');
      expect(tokenData.accessToken.split('.')).toHaveLength(3);
    });

    it('존재하지 않는 이메일로 로그인 시 401 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.message).toBe(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    });

    it('잘못된 비밀번호로 로그인 시 401 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.message).toBe(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    });

    it('이메일 형식이 잘못된 경우 400 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.message).toContain(
        '유효한 이메일 주소를 입력해주세요.',
      );
    });

    it('필수 필드 누락 시 400 에러', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.message).toContain('비밀번호는 필수 항목입니다.');
    });
  });

  describe('JWT 토큰 검증', () => {
    let accessToken: string;

    beforeAll(async () => {
      // 유저 정리 후 생성
      try {
        await dataSource
          .getRepository(User)
          .delete({ email: testUser.email });
      } catch (e) {
        // ignore
      }

      await request(app.getHttpServer()).post('/auth/signup').send(testUser);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      const tokenData =
        loginResponse.body.data.data || loginResponse.body.data;
      accessToken = tokenData.accessToken;
    });

    afterAll(async () => {
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource
            .getRepository(User)
            .delete({ email: testUser.email });
        } catch (e) {
          // ignore
        }
      }
    });

    it('발급된 JWT 토큰은 유효한 형식이어야 함', () => {
      expect(accessToken).toBeDefined();
      const parts = accessToken.split('.');
      expect(parts).toHaveLength(3);

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email', testUser.email);
      expect(payload).toHaveProperty('role', 'member');
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iat');
    });
  });
});
