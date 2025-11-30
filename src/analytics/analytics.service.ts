import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Chat } from '../chats/entities/chat.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
  ) {}

  async getActivityReport() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const signupCount = await this.userRepository.count({
      where: { createdAt: MoreThanOrEqual(since) },
    });

    const loginCount = await this.userRepository.count({
      where: { lastLoginAt: MoreThanOrEqual(since) },
    });

    const chatCount = await this.chatRepository.count({
      where: { createdAt: MoreThanOrEqual(since) },
    });

    return {
      period: {
        from: since,
        to: new Date(),
      },
      signupCount,
      loginCount,
      chatCount,
    };
  }
}
