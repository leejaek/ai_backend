import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedbacksService } from './feedbacks.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('feedbacks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feedbacks')
export class FeedbacksController {
  constructor(private feedbacksService: FeedbacksService) {}

  @Post()
  @ApiOperation({ summary: '피드백 생성' })
  @ApiResponse({ status: 201, description: '피드백 생성 성공' })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 대화가 아님)' })
  @ApiResponse({ status: 404, description: '대화를 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '이미 피드백 작성됨' })
  async create(@CurrentUser() user: User, @Body() dto: CreateFeedbackDto) {
    return this.feedbacksService.create(user.id, user.role, dto);
  }
}
