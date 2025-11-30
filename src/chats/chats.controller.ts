import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';
import { User } from '../users/entities/user.entity';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto';

@ApiTags('채팅')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @Post()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: '채팅 메시지 전송' })
  @ApiResponse({ status: 201, description: '채팅 생성 성공' })
  @ApiResponse({ status: 200, description: 'SSE 스트림 (isStreaming: true)' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 429, description: '요청 횟수 초과 (30회/분)' })
  async create(
    @CurrentUser() user: User,
    @Body() createChatDto: CreateChatDto,
    @Res() res: Response,
  ) {
    if (createChatDto.isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        const stream = this.chatsService.createStream(user.id, createChatDto);

        for await (const { event, data } of stream) {
          res.write(`event: ${event}\n`);
          res.write(`data: ${data}\n\n`);
        }
      } catch (error) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
      } finally {
        res.end();
      }
      return;
    }

    const result = await this.chatsService.create(user.id, createChatDto);
    res.status(201).json(result);
  }

  @Get('thread/:threadId')
  @ApiOperation({ summary: '스레드의 채팅 목록 조회' })
  @ApiResponse({ status: 200, description: '채팅 목록 반환' })
  @ApiResponse({ status: 403, description: '접근 권한 없음' })
  async findByThread(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
  ) {
    return this.chatsService.findByThreadId(threadId, user.id);
  }
}
