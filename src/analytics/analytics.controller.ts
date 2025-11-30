import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { AnalyticsService } from './analytics.service';

@ApiTags('분석')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('activity-report')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '활동 리포트 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '24시간 활동 통계 반환' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  async getActivityReport() {
    return this.analyticsService.getActivityReport();
  }
}
