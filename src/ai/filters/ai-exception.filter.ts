import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { AIException } from '../exceptions/ai.exception';

@Catch(AIException)
export class AIExceptionFilter implements ExceptionFilter {
  catch(exception: AIException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      errorCode: exception.details.code,
      provider: exception.details.provider,
      retryable: exception.details.retryable,
      timestamp: new Date().toISOString(),
    });
  }
}
