import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  IAIService,
} from '../interfaces/ai-service.interface';

@Injectable()
export class ClaudeProvider implements IAIService {
  readonly providerName = 'claude';
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
    this.defaultModel =
      this.configService.get<string>('ANTHROPIC_MODEL') ||
      'claude-sonnet-4-20250514';
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    const model = options?.model || this.defaultModel;
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      system: systemMessage,
      messages: nonSystemMessages,
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      finishReason: response.stop_reason,
      provider: this.providerName,
      model,
    };
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const stream = this.client.messages.stream({
      model: options?.model || this.defaultModel,
      max_tokens: options?.maxTokens || 4096,
      system: systemMessage,
      messages: nonSystemMessages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
