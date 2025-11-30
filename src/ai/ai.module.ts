import { DynamicModule, Module, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_SERVICE, IAIService } from './interfaces/ai-service.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { MockAIProvider } from './providers/mock-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';

export type AIProviderType = 'openai' | 'claude' | 'mock';

export interface AIModuleOptions {
  provider: AIProviderType;
}

const providerMap: Record<AIProviderType, Type<IAIService>> = {
  openai: OpenAIProvider,
  claude: ClaudeProvider,
  mock: MockAIProvider,
};

@Module({})
export class AIModule {
  static register(options: AIModuleOptions): DynamicModule {
    const providerClass = providerMap[options.provider] || OpenAIProvider;

    return {
      module: AIModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: AI_SERVICE,
          useClass: providerClass,
        },
      ],
      exports: [AI_SERVICE],
    };
  }

  static registerAsync(): DynamicModule {
    return {
      module: AIModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: AI_SERVICE,
          useFactory: (configService: ConfigService): IAIService => {
            const provider =
              configService.get<AIProviderType>('AI_PROVIDER') || 'openai';

            switch (provider) {
              case 'claude':
                return new ClaudeProvider(configService);
              case 'mock':
                return new MockAIProvider();
              case 'openai':
              default:
                return new OpenAIProvider(configService);
            }
          },
          inject: [ConfigService],
        },
      ],
      exports: [AI_SERVICE],
    };
  }
}
