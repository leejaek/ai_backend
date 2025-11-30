import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Node 환경
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // 서버 포트
  PORT: Joi.number().default(3000),

  // 데이터베이스 설정
  DB_HOST: Joi.string().required().messages({
    'any.required': 'DB_HOST 환경 변수가 필요합니다.',
  }),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required().messages({
    'any.required': 'DB_USERNAME 환경 변수가 필요합니다.',
  }),
  DB_PASSWORD: Joi.string().required().messages({
    'any.required': 'DB_PASSWORD 환경 변수가 필요합니다.',
  }),
  DB_DATABASE: Joi.string().required().messages({
    'any.required': 'DB_DATABASE 환경 변수가 필요합니다.',
  }),

  // JWT 설정
  JWT_SECRET: Joi.string().required().messages({
    'any.required': 'JWT_SECRET 환경 변수가 필요합니다.',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  // AI Provider 설정
  AI_PROVIDER: Joi.string()
    .valid('openai', 'claude', 'mock')
    .default('openai'),

  // OpenAI 설정 (AI_PROVIDER가 openai일 때 필수)
  OPENAI_API_KEY: Joi.string().when('AI_PROVIDER', {
    is: 'openai',
    then: Joi.required().messages({
      'any.required':
        'AI_PROVIDER가 openai일 때 OPENAI_API_KEY가 필요합니다.',
    }),
    otherwise: Joi.optional(),
  }),
  OPENAI_MODEL: Joi.string().optional(),

  // Claude 설정 (추후 확장용 - 현재는 optional)
  ANTHROPIC_API_KEY: Joi.string().optional(),
  ANTHROPIC_MODEL: Joi.string().optional(),

  // Thread 설정
  THREAD_TIMEOUT_MINUTES: Joi.number().default(30),
});
