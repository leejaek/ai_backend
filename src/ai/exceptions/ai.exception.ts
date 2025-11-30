import { HttpException, HttpStatus } from '@nestjs/common';

export enum AIErrorCode {
  AUTHENTICATION_ERROR = 'AI_AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'AI_RATE_LIMIT_ERROR',
  INVALID_REQUEST_ERROR = 'AI_INVALID_REQUEST_ERROR',
  MODEL_NOT_FOUND_ERROR = 'AI_MODEL_NOT_FOUND_ERROR',
  CONTEXT_LENGTH_ERROR = 'AI_CONTEXT_LENGTH_ERROR',
  SERVICE_UNAVAILABLE_ERROR = 'AI_SERVICE_UNAVAILABLE_ERROR',
  UNKNOWN_ERROR = 'AI_UNKNOWN_ERROR',
}

export interface AIExceptionDetails {
  code: AIErrorCode;
  provider: string;
  originalError?: string;
  retryable: boolean;
}

export class AIException extends HttpException {
  constructor(
    message: string,
    public readonly details: AIExceptionDetails,
    status: HttpStatus = HttpStatus.SERVICE_UNAVAILABLE,
  ) {
    super(
      {
        message,
        errorCode: details.code,
        provider: details.provider,
        retryable: details.retryable,
      },
      status,
    );
  }
}
