import { HttpStatus } from '@nestjs/common';
import { AIException, AIErrorCode } from '../exceptions/ai.exception';

/**
 * OpenAI SDK 에러를 AIException으로 변환
 * 추후 다른 Provider 추가 시 transformXXXError 함수를 같은 패턴으로 추가
 */
export function transformOpenAIError(
  error: any,
  provider = 'openai',
): AIException {
  const status = error.status || error.response?.status;

  switch (status) {
    case 401:
      return new AIException(
        'AI 서비스 인증에 실패했습니다.',
        { code: AIErrorCode.AUTHENTICATION_ERROR, provider, retryable: false },
        HttpStatus.UNAUTHORIZED,
      );
    case 429:
      return new AIException(
        'AI 서비스 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        { code: AIErrorCode.RATE_LIMIT_ERROR, provider, retryable: true },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    case 400:
      if (error.code === 'context_length_exceeded') {
        return new AIException(
          '입력이 너무 깁니다. 대화 내용을 줄여주세요.',
          { code: AIErrorCode.CONTEXT_LENGTH_ERROR, provider, retryable: false },
          HttpStatus.BAD_REQUEST,
        );
      }
      return new AIException(
        'AI 요청이 잘못되었습니다.',
        { code: AIErrorCode.INVALID_REQUEST_ERROR, provider, retryable: false },
        HttpStatus.BAD_REQUEST,
      );
    case 404:
      return new AIException(
        '요청한 AI 모델을 찾을 수 없습니다.',
        { code: AIErrorCode.MODEL_NOT_FOUND_ERROR, provider, retryable: false },
        HttpStatus.NOT_FOUND,
      );
    case 500:
    case 502:
    case 503:
      return new AIException(
        'AI 서비스가 일시적으로 이용 불가합니다.',
        {
          code: AIErrorCode.SERVICE_UNAVAILABLE_ERROR,
          provider,
          retryable: true,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    default:
      return new AIException(
        'AI 서비스 오류가 발생했습니다.',
        {
          code: AIErrorCode.UNKNOWN_ERROR,
          provider,
          originalError: error.message,
          retryable: false,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
  }
}

// 추후 Claude Provider 확장 시 아래 함수 구현
// export function transformAnthropicError(error: any, provider = 'claude'): AIException { ... }
