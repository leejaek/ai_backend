import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetFeedbacksDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '긍정/부정 필터 (true: 긍정, false: 부정)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPositive?: boolean;

  @ApiPropertyOptional({
    description: '특정 유저의 피드백만 조회 (관리자 전용)',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
