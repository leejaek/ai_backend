import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AI_SERVICE,
  ChatMessage,
  IAIService,
} from '../ai/interfaces/ai-service.interface';
import { ThreadsService } from '../threads/threads.service';
import { CreateChatDto } from './dto';
import { Chat } from './entities/chat.entity';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    @InjectRepository(Chat)
    private chatsRepository: Repository<Chat>,
    private threadsService: ThreadsService,
    @Inject(AI_SERVICE) private aiService: IAIService,
  ) {}

  async create(
    userId: string,
    createChatDto: CreateChatDto,
  ): Promise<{ chat: Chat; threadId: string }> {
    const startTime = Date.now();
    const thread = await this.threadsService.findOrCreateActiveThread(userId);
    const threadId = thread.id;

    const previousChats = await this.chatsRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '당신은 친절하고 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.',
      },
    ];

    for (const chat of previousChats) {
      messages.push({ role: 'user', content: chat.question });
      messages.push({ role: 'assistant', content: chat.answer });
    }

    messages.push({ role: 'user', content: createChatDto.question });

    this.logger.log(
      `AI 요청 시작 - userId: ${userId}, model: ${createChatDto.model || 'default'}, historyCount: ${previousChats.length}`,
    );

    const response = await this.aiService.chatCompletion(messages, {
      model: createChatDto.model,
    });

    const duration = Date.now() - startTime;
    this.logger.log(
      `AI 응답 완료 - userId: ${userId}, provider: ${response.provider}, duration: ${duration}ms`,
    );

    const chat = this.chatsRepository.create({
      threadId,
      question: createChatDto.question,
      answer: response.content,
    });

    const savedChat = await this.chatsRepository.save(chat);

    await this.threadsService.updateTimestamp(threadId);

    return { chat: savedChat, threadId };
  }

  async *createStream(
    userId: string,
    createChatDto: CreateChatDto,
  ): AsyncGenerator<{ event: string; data: string }, void, unknown> {
    const startTime = Date.now();
    const thread = await this.threadsService.findOrCreateActiveThread(userId);
    const threadId = thread.id;

    yield { event: 'thread', data: JSON.stringify({ threadId }) };

    const previousChats = await this.chatsRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '당신은 친절하고 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.',
      },
    ];

    for (const chat of previousChats) {
      messages.push({ role: 'user', content: chat.question });
      messages.push({ role: 'assistant', content: chat.answer });
    }

    messages.push({ role: 'user', content: createChatDto.question });

    this.logger.log(
      `AI 스트림 요청 시작 - userId: ${userId}, model: ${createChatDto.model || 'default'}, historyCount: ${previousChats.length}`,
    );

    let fullAnswer = '';

    const stream = this.aiService.chatCompletionStream(messages, {
      model: createChatDto.model,
    });

    for await (const chunk of stream) {
      fullAnswer += chunk;
      yield { event: 'message', data: chunk };
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `AI 스트림 완료 - userId: ${userId}, duration: ${duration}ms`,
    );

    const chat = this.chatsRepository.create({
      threadId,
      question: createChatDto.question,
      answer: fullAnswer,
    });

    const savedChat = await this.chatsRepository.save(chat);

    await this.threadsService.updateTimestamp(threadId);

    yield {
      event: 'done',
      data: JSON.stringify({ chatId: savedChat.id, threadId }),
    };
  }

  async findByThreadId(threadId: string, userId: string): Promise<Chat[]> {
    const thread = await this.threadsService.findByIdAndUserId(
      threadId,
      userId,
    );
    if (!thread) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    return this.chatsRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Chat | null> {
    return this.chatsRepository.findOne({ where: { id } });
  }
}
