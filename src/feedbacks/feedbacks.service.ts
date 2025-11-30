import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ChatsService } from '../chats/chats.service';
import { ThreadsService } from '../threads/threads.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class FeedbacksService {
  constructor(
    @InjectRepository(Feedback)
    private feedbacksRepository: Repository<Feedback>,
    private chatsService: ChatsService,
    private threadsService: ThreadsService,
  ) {}

  async create(
    userId: string,
    userRole: UserRole,
    dto: CreateFeedbackDto,
  ): Promise<Feedback> {
    // 1. Chat 존재 확인
    const chat = await this.chatsService.findById(dto.chatId);
    if (!chat) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }

    // 2. 권한 검증 (관리자가 아니면 소유권 확인)
    if (userRole !== UserRole.ADMIN) {
      const thread = await this.threadsService.findById(chat.threadId);
      if (!thread || thread.userId !== userId) {
        throw new ForbiddenException(
          '본인의 대화에만 피드백을 작성할 수 있습니다.',
        );
      }
    }

    // 3. 중복 피드백 확인 (Unique 제약으로 DB에서도 처리되지만 명시적 에러 메시지 제공)
    const existing = await this.feedbacksRepository.findOne({
      where: { userId, chatId: dto.chatId },
    });
    if (existing) {
      throw new ConflictException('이미 해당 대화에 피드백을 작성하셨습니다.');
    }

    // 4. 피드백 생성
    const feedback = this.feedbacksRepository.create({
      userId,
      chatId: dto.chatId,
      isPositive: dto.isPositive,
    });

    return this.feedbacksRepository.save(feedback);
  }
}
