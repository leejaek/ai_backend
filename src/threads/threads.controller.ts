import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { GetThreadsDto } from './dto';
import { ThreadsService } from './threads.service';

@ApiTags('스레드')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('threads')
export class ThreadsController {
  constructor(private threadsService: ThreadsService) {}

  @Get()
  @ApiOperation({ summary: '내 스레드 목록 조회' })
  @ApiResponse({ status: 200, description: '스레드 목록 반환' })
  async findMyThreads(
    @CurrentUser() user: User,
    @Query() dto: GetThreadsDto,
  ) {
    return this.threadsService.findByUserIdPaginated(user.id, dto);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '전체 스레드 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '전체 스레드 목록 반환' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async findAllThreads(@Query() dto: GetThreadsDto) {
    return this.threadsService.findAllPaginated(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '스레드 상세 조회' })
  @ApiResponse({ status: 200, description: '스레드 상세 반환' })
  @ApiResponse({ status: 403, description: '접근 권한 없음' })
  @ApiResponse({ status: 404, description: '스레드를 찾을 수 없음' })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const thread = await this.threadsService.findById(id);

    if (!thread) {
      throw new NotFoundException('스레드를 찾을 수 없습니다.');
    }

    if (thread.userId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    return thread;
  }
}
