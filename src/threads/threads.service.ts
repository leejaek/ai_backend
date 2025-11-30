import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThan, Repository } from 'typeorm';
import {
  PaginationMeta,
  SortOrder,
} from '../common/dto/pagination.dto';
import { GetThreadsDto } from './dto';
import { Thread } from './entities/thread.entity';

@Injectable()
export class ThreadsService {
  private readonly sessionTimeoutMinutes: number;

  constructor(
    @InjectRepository(Thread)
    private threadsRepository: Repository<Thread>,
    private configService: ConfigService,
  ) {
    this.sessionTimeoutMinutes = this.configService.get<number>(
      'THREAD_TIMEOUT_MINUTES',
      30,
    );
  }

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
      Date.now() - this.sessionTimeoutMinutes * 60 * 1000,
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

  async findByUserIdPaginated(
    userId: string,
    dto: GetThreadsDto,
  ): Promise<{ data: Thread[]; meta: PaginationMeta }> {
    const { page = 1, limit = 20, sort = SortOrder.DESC } = dto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.threadsRepository.findAndCount({
      where: { userId },
      relations: ['chats'],
      order: { createdAt: sort.toUpperCase() as 'ASC' | 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: new PaginationMeta(page, limit, total),
    };
  }

  async findAllPaginated(
    dto: GetThreadsDto,
  ): Promise<{ data: Thread[]; meta: PaginationMeta }> {
    const { page = 1, limit = 20, sort = SortOrder.DESC, userId } = dto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Thread> = {};
    if (userId) {
      where.userId = userId;
    }

    const [data, total] = await this.threadsRepository.findAndCount({
      where,
      relations: ['chats'],
      order: { createdAt: sort.toUpperCase() as 'ASC' | 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: new PaginationMeta(page, limit, total),
    };
  }
}
