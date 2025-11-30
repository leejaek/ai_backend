import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Thread } from './entities/thread.entity';
import { ThreadsService } from './threads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Thread])],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
