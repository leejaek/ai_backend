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

  async generateChatReportCsv(): Promise<string> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const chats = await this.chatRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.thread', 'thread')
      .leftJoinAndSelect('thread.user', 'user')
      .where('chat.createdAt >= :since', { since })
      .orderBy('chat.createdAt', 'DESC')
      .getMany();

    const headers = [
      'chat_id',
      'thread_id',
      'user_id',
      'user_email',
      'user_name',
      'question',
      'answer',
      'created_at',
    ];

    const rows = chats.map((chat) => [
      chat.id,
      chat.threadId,
      chat.thread?.userId || '',
      chat.thread?.user?.email || '',
      chat.thread?.user?.name || '',
      this.escapeCsvField(chat.question),
      this.escapeCsvField(chat.answer),
      chat.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  private escapeCsvField(field: string): string {
    if (!field) return '""';
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
