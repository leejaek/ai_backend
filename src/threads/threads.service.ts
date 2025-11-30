import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Thread } from './entities/thread.entity';

@Injectable()
export class ThreadsService {
  private readonly SESSION_TIMEOUT_MINUTES = 30;

  constructor(
    @InjectRepository(Thread)
    private threadsRepository: Repository<Thread>,
  ) {}

  async create(userId: string): Promise<Thread> {
    const thread = this.threadsRepository.create({ userId });
    return this.threadsRepository.save(thread);
  }

  async findById(id: string): Promise<Thread | null> {
    return this.threadsRepository.findOne({
      where: { id },
      relations: ['chats'],
    });
  }

  async findByUserId(userId: string): Promise<Thread[]> {
    return this.threadsRepository.find({
      where: { userId },
      relations: ['chats'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Thread | null> {
    return this.threadsRepository.findOne({
      where: { id, userId },
      relations: ['chats'],
    });
  }

  async findActiveThreadByUserId(userId: string): Promise<Thread | null> {
    const timeoutThreshold = new Date(
      Date.now() - this.SESSION_TIMEOUT_MINUTES * 60 * 1000,
    );

    return this.threadsRepository.findOne({
      where: {
        userId,
        updatedAt: MoreThan(timeoutThreshold),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOrCreateActiveThread(userId: string): Promise<Thread> {
    const activeThread = await this.findActiveThreadByUserId(userId);

    if (activeThread) {
      return activeThread;
    }

    return this.create(userId);
  }

  async updateTimestamp(id: string): Promise<void> {
    await this.threadsRepository.update(id, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await this.threadsRepository.delete(id);
  }
}
