import { Injectable } from '@nestjs/common';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  IAIService,
} from '../interfaces/ai-service.interface';

@Injectable()
export class MockAIProvider implements IAIService {
  readonly providerName = 'mock';
  private mockResponse: string = '이것은 Mock 응답입니다.';
  private mockDelay: number = 100;
  private mockModel: string = 'mock-model';

  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  setMockDelay(delay: number): void {
    this.mockDelay = delay;
  }

  setMockModel(model: string): void {
    this.mockModel = model;
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
      provider: this.providerName,
      model: options?.model || this.mockModel,
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
