import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
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

  @Get('chat-report')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '대화 보고서 CSV 다운로드 (관리자)' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV 파일 반환' })
  @ApiResponse({ status: 403, description: '관리자 권한 필요' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="chat-report.csv"')
  async getChatReportCsv(@Res() res: Response) {
    const csv = await this.analyticsService.generateChatReportCsv();
    const bom = '\uFEFF';
    res.send(bom + csv);
  }
}
