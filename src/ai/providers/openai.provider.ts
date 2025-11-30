import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  IAIService,
} from '../interfaces/ai-service.interface';
import { transformOpenAIError } from '../utils/error-transformer';

@Injectable()
export class OpenAIProvider implements IAIService {
  readonly providerName = 'openai';
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    try {
      const model = options?.model || this.defaultModel;
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason,
        provider: this.providerName,
        model,
      };
    } catch (error) {
      throw transformOpenAIError(error, this.providerName);
    }
  }

  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      throw transformOpenAIError(error, this.providerName);
    }
  }
}
