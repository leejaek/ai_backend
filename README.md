# AI Backend

NestJS 기반 AI 채팅 백엔드 API 서버

## 과제 제출 답변

### 과제를 어떻게 분석하셨나요?
- 요구사항을 도메인 별로 명확히 구분해서, 
- 추후 확장 개발이 가능해야한다는 점에 주목하여 이에 대한 아키텍처 설계를 고민
- AI 서비스라는 점을 고려해 외부 서비스 의존으로 인해 발생할 수 있는 문제점들에 대해 고민

### 과제의 진행함에 있어 AI 를 어떻게 활용 하셨나요? 어떤 어려움이 있었나요?
- 초기 과제 분석 및 구현 계획 단계에서 AI를 활용하여 단계적 구현 계획을 설계
- 짧은 시간 내 기능을 병렬적으로 구현하기 위해 동시에 Agent를 활용
  - 여러 구현을 동시에 함으로써 Agent 간 충돌을 피하기 위한 어려움이 있었음
  - 가능한 동시에 작업하는 부분이 겹치지 않도록 함 (모듈 별 혹은 테스트 )
- 가능한 구체적인 프롬프트 입력을 통해 예상을 벗어난 코드 구현을 방지하고자 함

### 지원자가 구현하기 가장 어려웠던 1개 이상의 기능을 설명해주세요.
> 추후 이 코드를 기반으로 확장됐을 때 생길 수 있는 문제들에 대한 고민이 가장 컸음
1. 확장성을 고려한 AI Model을 유연하게 교체할 수 있는 구조 설계가 가장 고민했던 부분
   - `IAIService` 공통 인터페이스를 정의하여, `generateResponse`와 같이 표준화된 메서드를 선언
   - 각기 다른 Provider에 위 인터페이스를 구현하도록 해서, AI 서비스별 SDK 호출 로직을 캡슐화
   - 비즈니스 로직에서 구체적인 AI 서비스를 알 필요 없이 Interface에만 의존하도록 하여 결합도를 낮춤
2. 분석 및 보고 기능의 csv 파일 작성에 대한 부하
    - 해당 부분에 대해 고려하여 별도의 worker-thread로 로직을 뺴는 것을 고민
    - 현재 시간이 부족한 상황을 고려해 추후 실제 이로 인한 병목이 발생했을 때 구현하는 것으로 남겨둠
3. 스레드를 조회할 경우 모든 Chat을 가져올 것인가? 
    - 추후 Chat 까지 모두 가져올 것인지에 대한 Option이나 질문 제목만 가져올지 등에 대한 의사결정이 필요할 것으로 보임
4. AI 에 질의할 때마다 기존 Thread의 모든 Chat 기록을 같이 보낼 것 인가?
   - Token이 기하급수적으로 늘어날 확률이 있음
   - 기본적으로 Throttle을 걸어두었지만 추후 이에 대한 제한이 필요할 것을 보임

## 주요 기능

- **인증**: JWT 기반 회원가입/로그인
- **채팅**: AI 모델과 대화 (OpenAI, Claude, Mock 지원)
- **스레드**: 대화 스레드 관리
- **스트리밍**: SSE 기반 실시간 응답
- **피드백**: 채팅 피드백 수집
- **분석**: 활동 리포트 (관리자)
- **Rate Limiting**: 30회/분 요청 제한

## 기술 스택

- NestJS
- TypeORM + PostgreSQL
- JWT 인증
- Swagger API 문서
- Jest (테스트)

## 빠른 시작 (Docker)

```bash
# 저장소 클론 후 바로 실행
git clone <repository-url>
cd ai_backend
cp .env.example .env
docker-compose up
```

기본 설정은 `AI_PROVIDER=mock`이므로 API 키 없이 바로 테스트할 수 있습니다.

## 설치 (로컬)

```bash
npm install
```

## 환경 변수

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=ai_db

# JWT
JWT_SECRET=your-secret-key

# AI Provider (openai | claude | mock)
AI_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=your-openai-key

# Claude (optional)
ANTHROPIC_API_KEY=your-anthropic-key
```

## 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 모드
npm run start:prod
```

## API 문서

서버 실행 후 Swagger UI 접속:
```
http://localhost:3000/api
```

## 테스트

```bash
# 단위 테스트
npm run test

# e2e 테스트 (전체)
npm run test:e2e

# e2e 테스트 (특정 파일)
npm run test:e2e -- --testPathPattern=chats
npm run test:e2e -- --testPathPattern=auth
```

### e2e 테스트 환경

- PostgreSQL 실행 필요 (localhost:5432)
- AI Service는 자동으로 Mock 사용 (`AI_PROVIDER=mock`)

## 프로젝트 구조

```
src/
├── ai/                 # AI 서비스 (OpenAI, Claude, Mock)
├── analytics/          # 활동 분석
├── auth/               # 인증 (JWT)
├── chats/              # 채팅 API
├── common/             # 공통 모듈 (Guards, Interceptors, Decorators)
├── feedbacks/          # 피드백
├── threads/            # 스레드 관리
└── users/              # 사용자 관리

test/
├── setup-e2e.ts        # e2e 테스트 환경 설정
├── auth.e2e-spec.ts    # 인증 e2e 테스트
└── chats.e2e-spec.ts   # 채팅 e2e 테스트
```

## AI Provider 설정

환경변수 `AI_PROVIDER`로 AI 서비스 선택:

| Provider | 설명 |
|----------|------|
| `openai` | OpenAI GPT 모델 (기본값) |
| `claude` | Anthropic Claude 모델 |
| `mock` | 테스트용 Mock 응답 |

## License

MIT
