import { Injectable } from '@nestjs/common';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  IOpenAIService,
} from '../interfaces/openai-service.interface';

@Injectable()
export class MockOpenAIProvider implements IOpenAIService {
  private mockResponse: string = '이것은 Mock 응답입니다.';
  private mockDelay: number = 100;

  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  setMockDelay(delay: number): void {
    this.mockDelay = delay;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    await this.delay(this.mockDelay);

    const lastUserMessage = messages
      .filter((m) => m.role === 'user')
      .pop()?.content;

    return {
      content: `[Mock] ${this.mockResponse} (질문: ${lastUserMessage || 'N/A'})`,
      finishReason: 'stop',
    };
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const lastUserMessage = messages
      .filter((m) => m.role === 'user')
      .pop()?.content;

    const fullResponse = `[Mock] ${this.mockResponse} (질문: ${lastUserMessage || 'N/A'})`;
    const words = fullResponse.split(' ');

    for (const word of words) {
      await this.delay(50);
      yield word + ' ';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
