import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OPENAI_SERVICE } from './interfaces/openai-service.interface';
import { MockOpenAIProvider } from './providers/mock-openai.provider';
import { OpenAIProvider } from './providers/openai.provider';

export interface OpenAIModuleOptions {
  useMock?: boolean;
}

@Module({})
export class OpenAIModule {
  static register(options?: OpenAIModuleOptions): DynamicModule {
    const provider = {
      provide: OPENAI_SERVICE,
      useClass: options?.useMock ? MockOpenAIProvider : OpenAIProvider,
    };

    return {
      module: OpenAIModule,
      imports: [ConfigModule],
      providers: [provider],
      exports: [OPENAI_SERVICE],
    };
  }

  static registerAsync(): DynamicModule {
    return {
      module: OpenAIModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: OPENAI_SERVICE,
          useFactory: (configService: ConfigService) => {
            const useMock =
              configService.get<string>('OPENAI_USE_MOCK') === 'true';
            return useMock
              ? new MockOpenAIProvider()
              : new OpenAIProvider(configService);
          },
          inject: [ConfigService],
        },
      ],
      exports: [OPENAI_SERVICE],
    };
  }
}
