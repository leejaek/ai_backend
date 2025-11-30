# AI 챗봇 서비스 구현 계획서

## 1. 개요

### 1.1 프로젝트 현황
- **프레임워크**: NestJS v11.0.1
- **데이터베이스**: PostgreSQL 15.8 (Docker Compose로 구성됨)
- **현재 상태**: 기본 보일러플레이트만 존재, ORM 및 인증 미구현

### 1.2 기술 스택 선정
| 영역 | 기술 | 선정 이유 |
|------|------|-----------|
| ORM | TypeORM | NestJS와의 높은 호환성, 데코레이터 기반 엔티티 정의 |
| 인증 | Passport + JWT | NestJS 공식 지원, 확장성 |
| 유효성 검증 | class-validator | DTO 기반 검증, NestJS 통합 |
| API 문서화 | Swagger | 자동 문서 생성, 테스트 UI 제공 |
| 스트리밍 | SSE (Server-Sent Events) | OpenAI 스트리밍 응답 처리 |
| CSV 생성 | json2csv | 보고서 생성용 |

---

## 2. 데이터베이스 스키마 설계

### 2.1 ERD (Entity Relationship Diagram)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │     Thread      │       │      Chat       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK, UUID)   │──┐    │ id (PK, UUID)   │──┐    │ id (PK, UUID)   │
│ email (unique)  │  │    │ userId (FK)     │  │    │ threadId (FK)   │
│ password        │  └───<│ createdAt       │  └───<│ question        │
│ name            │       │ updatedAt       │       │ answer          │
│ role            │       └─────────────────┘       │ createdAt       │
│ createdAt       │                                 └────────┬────────┘
└─────────────────┘                                          │
                                                             │
┌─────────────────┐                                          │
│    Feedback     │                                          │
├─────────────────┤                                          │
│ id (PK, UUID)   │                                          │
│ userId (FK)     │<─────────────────────────────────────────┘
│ chatId (FK)     │
│ isPositive      │
│ status          │
│ createdAt       │
└─────────────────┘

┌─────────────────┐
│  ActivityLog    │
├─────────────────┤
│ id (PK, UUID)   │
│ userId (FK)     │
│ action          │
│ createdAt       │
└─────────────────┘
```

### 2.2 엔티티 상세 정의

#### User Entity
```typescript
{
  id: UUID (PK, auto-generated)
  email: string (unique, not null)
  password: string (hashed, not null)
  name: string (not null)
  role: enum ['member', 'admin'] (default: 'member')
  createdAt: timestamptz (auto-generated)
}
```

#### Thread Entity
```typescript
{
  id: UUID (PK, auto-generated)
  userId: UUID (FK -> User.id)
  createdAt: timestamptz (auto-generated)
  updatedAt: timestamptz (auto-updated)
}
```

#### Chat Entity
```typescript
{
  id: UUID (PK, auto-generated)
  threadId: UUID (FK -> Thread.id)
  question: string (not null)
  answer: string (not null)
  createdAt: timestamptz (auto-generated)
}
```

#### Feedback Entity
```typescript
{
  id: UUID (PK, auto-generated)
  userId: UUID (FK -> User.id)
  chatId: UUID (FK -> Chat.id)
  isPositive: boolean (not null)
  status: enum ['pending', 'resolved'] (default: 'pending')
  createdAt: timestamptz (auto-generated)
}
// Unique constraint: (userId, chatId)
```

#### ActivityLog Entity
```typescript
{
  id: UUID (PK, auto-generated)
  userId: UUID (FK -> User.id, nullable)
  action: enum ['signup', 'login', 'chat_create']
  createdAt: timestamptz (auto-generated)
}
```

---

## 3. 모듈 구조

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts    # 현재 사용자 추출
│   │   └── roles.decorator.ts           # 역할 데코레이터
│   ├── guards/
│   │   ├── jwt-auth.guard.ts            # JWT 인증 가드
│   │   └── roles.guard.ts               # 역할 기반 접근 제어
│   ├── filters/
│   │   └── http-exception.filter.ts     # 전역 예외 필터
│   ├── interceptors/
│   │   └── transform.interceptor.ts     # 응답 변환
│   └── dto/
│       └── pagination.dto.ts            # 공통 페이지네이션 DTO
│
├── config/
│   ├── database.config.ts               # TypeORM 설정
│   └── jwt.config.ts                    # JWT 설정
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── dto/
│   │       ├── signup.dto.ts
│   │       └── login.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   │
│   ├── chat/
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts
│   │   ├── chat.service.ts
│   │   ├── entities/
│   │   │   ├── thread.entity.ts
│   │   │   └── chat.entity.ts
│   │   └── dto/
│   │       ├── create-chat.dto.ts
│   │       └── chat-list-query.dto.ts
│   │
│   ├── feedback/
│   │   ├── feedback.module.ts
│   │   ├── feedback.controller.ts
│   │   ├── feedback.service.ts
│   │   ├── entities/
│   │   │   └── feedback.entity.ts
│   │   └── dto/
│   │       ├── create-feedback.dto.ts
│   │       ├── update-feedback.dto.ts
│   │       └── feedback-query.dto.ts
│   │
│   ├── analytics/
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   └── entities/
│   │       └── activity-log.entity.ts
│   │
│   └── openai/
│       ├── openai.module.ts
│       └── openai.service.ts            # OpenAI API 통신
```

---

## 4. API 엔드포인트 설계

### 4.1 인증 API (Auth)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/auth/signup` | 회원가입 | X |
| POST | `/auth/login` | 로그인 | X |

#### POST /auth/signup
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "홍길동"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "홍길동",
  "role": "member",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### POST /auth/login
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 4.2 대화 API (Chat)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/chats` | 대화 생성 | O |
| GET | `/chats` | 대화 목록 조회 | O |
| DELETE | `/threads/:threadId` | 스레드 삭제 | O |

#### POST /chats
**Request Body:**
```json
{
  "question": "NestJS란 무엇인가요?",
  "isStreaming": false,
  "model": "gpt-4"
}
```

**Response (201) - Non-streaming:**
```json
{
  "id": "uuid",
  "threadId": "uuid",
  "question": "NestJS란 무엇인가요?",
  "answer": "NestJS는 Node.js 기반의 프레임워크입니다...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Response - Streaming (SSE):**
```
data: {"content": "NestJS"}
data: {"content": "는"}
data: {"content": " Node.js"}
...
data: [DONE]
```

#### GET /chats
**Query Parameters:**
- `sort`: `asc` | `desc` (default: `desc`)
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "threadId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "chats": [
        {
          "id": "uuid",
          "question": "질문1",
          "answer": "답변1",
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### DELETE /threads/:threadId
**Response (200):**
```json
{
  "message": "Thread deleted successfully"
}
```

---

### 4.3 피드백 API (Feedback)

| Method | Endpoint | 설명 | 인증 | 권한 |
|--------|----------|------|------|------|
| POST | `/feedbacks` | 피드백 생성 | O | - |
| GET | `/feedbacks` | 피드백 목록 조회 | O | - |
| PATCH | `/feedbacks/:id/status` | 피드백 상태 변경 | O | admin |

#### POST /feedbacks
**Request Body:**
```json
{
  "chatId": "uuid",
  "isPositive": true
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "chatId": "uuid",
  "userId": "uuid",
  "isPositive": true,
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET /feedbacks
**Query Parameters:**
- `isPositive`: `true` | `false` (optional)
- `sort`: `asc` | `desc` (default: `desc`)
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "chatId": "uuid",
      "isPositive": true,
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### PATCH /feedbacks/:id/status
**Request Body:**
```json
{
  "status": "resolved"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "resolved",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4.4 분석 API (Analytics)

| Method | Endpoint | 설명 | 인증 | 권한 |
|--------|----------|------|------|------|
| GET | `/analytics/activity` | 사용자 활동 기록 조회 | O | admin |
| GET | `/analytics/report` | 보고서 다운로드 | O | admin |

#### GET /analytics/activity
**Response (200):**
```json
{
  "date": "2024-01-01",
  "signupCount": 10,
  "loginCount": 50,
  "chatCount": 200
}
```

#### GET /analytics/report
**Response:** CSV 파일 다운로드
```
Content-Type: text/csv
Content-Disposition: attachment; filename="report_2024-01-01.csv"
```

**CSV 내용:**
```csv
chat_id,question,answer,user_id,user_email,user_name,created_at
uuid1,"질문1","답변1",uuid,user@example.com,홍길동,2024-01-01T00:00:00.000Z
```

---

## 5. 구현 단계

### Phase 1: 기반 설정
1. **필수 패키지 설치**
   ```bash
   npm install @nestjs/typeorm typeorm pg
   npm install @nestjs/passport passport passport-jwt @nestjs/jwt
   npm install class-validator class-transformer
   npm install @nestjs/swagger swagger-ui-express
   npm install bcrypt
   npm install openai
   npm install json2csv
   npm install -D @types/passport-jwt @types/bcrypt
   ```

2. **TypeORM 데이터베이스 연결 설정**
3. **전역 파이프, 필터, 인터셉터 설정**
4. **Swagger 설정**

### Phase 2: 사용자 관리 및 인증
1. User 엔티티 생성
2. Auth 모듈 구현 (회원가입, 로그인)
3. JWT Strategy 및 Guard 구현
4. Roles Guard 구현

### Phase 3: 대화 관리
1. Thread, Chat 엔티티 생성
2. OpenAI 서비스 구현
3. Chat 서비스 구현 (스레드 로직 포함)
4. SSE 스트리밍 구현
5. 대화 목록 조회 API 구현
6. 스레드 삭제 API 구현

### Phase 4: 피드백 관리
1. Feedback 엔티티 생성
2. 피드백 CRUD 구현
3. 권한 기반 접근 제어 적용

### Phase 5: 분석 및 보고
1. ActivityLog 엔티티 생성
2. 활동 기록 로깅 구현 (회원가입, 로그인, 대화 생성 시)
3. 활동 통계 API 구현
4. CSV 보고서 생성 API 구현

### Phase 6: 테스트 및 문서화
1. 단위 테스트 작성
2. E2E 테스트 작성
3. Swagger 문서 보완

---

## 6. 주요 비즈니스 로직

### 6.1 스레드 생성 로직
```
대화 생성 요청 시:
1. 해당 사용자의 가장 최근 스레드 조회
2. IF 스레드가 없음 OR 마지막 대화로부터 30분 초과:
   → 새 스레드 생성
3. ELSE:
   → 기존 스레드 사용 (updatedAt 갱신)
4. 해당 스레드에 대화 추가
```

### 6.2 OpenAI 요청 시 컨텍스트 구성
```
대화 생성 요청 시:
1. 현재 스레드의 모든 대화 조회
2. OpenAI 메시지 배열 구성:
   [
     { role: "system", content: "시스템 프롬프트" },
     { role: "user", content: "이전 질문1" },
     { role: "assistant", content: "이전 답변1" },
     ...
     { role: "user", content: "현재 질문" }
   ]
3. OpenAI API 호출
```

### 6.3 피드백 중복 방지
```
피드백 생성 요청 시:
1. (userId, chatId) 조합으로 기존 피드백 존재 여부 확인
2. IF 존재:
   → 409 Conflict 에러 반환
3. ELSE:
   → 피드백 생성
```

---

## 7. 보안 고려사항

1. **비밀번호 암호화**: bcrypt를 사용하여 해싱 (salt rounds: 10)
2. **JWT 설정**:
   - 비밀키: 환경변수로 관리
   - 만료시간: 1시간 (설정 가능)
3. **입력 검증**: class-validator를 통한 DTO 검증
4. **권한 제어**: Role 기반 Guard로 관리자 전용 API 보호
5. **SQL Injection 방지**: TypeORM의 파라미터 바인딩 사용

---

## 8. 환경 변수 추가 필요

```env
# 기존
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=ai_db
OPEN_AI_API_KEY=your_openai_api_key

# 추가 필요
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1h
OPENAI_DEFAULT_MODEL=gpt-3.5-turbo
THREAD_TIMEOUT_MINUTES=30
```

---

## 9. 예상 일정 (참고용)

| Phase | 내용 | 예상 작업량 |
|-------|------|-------------|
| Phase 1 | 기반 설정 | 소 |
| Phase 2 | 사용자 관리 및 인증 | 중 |
| Phase 3 | 대화 관리 | 대 |
| Phase 4 | 피드백 관리 | 중 |
| Phase 5 | 분석 및 보고 | 중 |
| Phase 6 | 테스트 및 문서화 | 중 |

---

## 10. 파일 생성 목록

### 설정 파일
- `src/config/database.config.ts`
- `src/config/jwt.config.ts`

### 공통 모듈
- `src/common/decorators/current-user.decorator.ts`
- `src/common/decorators/roles.decorator.ts`
- `src/common/guards/jwt-auth.guard.ts`
- `src/common/guards/roles.guard.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/interceptors/transform.interceptor.ts`
- `src/common/dto/pagination.dto.ts`

### Auth 모듈
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/strategies/jwt.strategy.ts`
- `src/modules/auth/dto/signup.dto.ts`
- `src/modules/auth/dto/login.dto.ts`

### Users 모듈
- `src/modules/users/users.module.ts`
- `src/modules/users/users.service.ts`
- `src/modules/users/entities/user.entity.ts`

### Chat 모듈
- `src/modules/chat/chat.module.ts`
- `src/modules/chat/chat.controller.ts`
- `src/modules/chat/chat.service.ts`
- `src/modules/chat/entities/thread.entity.ts`
- `src/modules/chat/entities/chat.entity.ts`
- `src/modules/chat/dto/create-chat.dto.ts`
- `src/modules/chat/dto/chat-list-query.dto.ts`

### Feedback 모듈
- `src/modules/feedback/feedback.module.ts`
- `src/modules/feedback/feedback.controller.ts`
- `src/modules/feedback/feedback.service.ts`
- `src/modules/feedback/entities/feedback.entity.ts`
- `src/modules/feedback/dto/create-feedback.dto.ts`
- `src/modules/feedback/dto/update-feedback.dto.ts`
- `src/modules/feedback/dto/feedback-query.dto.ts`

### Analytics 모듈
- `src/modules/analytics/analytics.module.ts`
- `src/modules/analytics/analytics.controller.ts`
- `src/modules/analytics/analytics.service.ts`
- `src/modules/analytics/entities/activity-log.entity.ts`

### OpenAI 모듈
- `src/modules/openai/openai.module.ts`
- `src/modules/openai/openai.service.ts`

---

이 문서는 AI 챗봇 서비스의 전체 구현 계획을 담고 있습니다. 각 Phase별로 순차적으로 진행하며, 필요에 따라 세부 사항을 조정할 수 있습니다.
