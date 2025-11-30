export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  finishReason: string | null;
}

export interface IOpenAIService {
  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse>;

  chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<string, void, unknown>;
}

export const OPENAI_SERVICE = Symbol('OPENAI_SERVICE');
