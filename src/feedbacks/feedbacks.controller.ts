import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FeedbacksService } from './feedbacks.service';
import { CreateFeedbackDto, GetFeedbacksDto } from './dto';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('feedbacks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feedbacks')
export class FeedbacksController {
  constructor(private feedbacksService: FeedbacksService) {}

  @Get()
  @ApiOperation({ summary: '내 피드백 목록 조회' })
  @ApiResponse({ status: 200, description: '피드백 목록 반환' })
  async findMyFeedbacks(
    @CurrentUser() user: User,
    @Query() dto: GetFeedbacksDto,
  ) {
    return this.feedbacksService.findByUserIdPaginated(user.id, dto);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '전체 피드백 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '전체 피드백 목록 반환' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async findAllFeedbacks(@Query() dto: GetFeedbacksDto) {
    return this.feedbacksService.findAllPaginated(dto);
  }

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
