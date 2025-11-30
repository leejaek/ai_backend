import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsModule } from '../chats/chats.module';
import { ThreadsModule } from '../threads/threads.module';
import { Feedback } from './entities/feedback.entity';
import { FeedbacksController } from './feedbacks.controller';
import { FeedbacksService } from './feedbacks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Feedback]),
    ChatsModule,
    ThreadsModule,
  ],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
  exports: [FeedbacksService],
})
export class FeedbacksModule {}
