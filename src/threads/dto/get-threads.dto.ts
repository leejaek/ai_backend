import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetThreadsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '특정 유저의 스레드만 조회 (관리자 전용)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: '유효한 UUID 형식이어야 합니다.' })
  userId?: string;
}
