import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModule } from '../ai/ai.module';
import { ThreadsModule } from '../threads/threads.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { Chat } from './entities/chat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat]),
    ThreadsModule,
    AIModule.registerAsync(),
  ],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
