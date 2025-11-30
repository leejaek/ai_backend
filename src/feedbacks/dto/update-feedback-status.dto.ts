import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FeedbackStatus } from '../entities/feedback.entity';

export class UpdateFeedbackStatusDto {
  @ApiProperty({ enum: FeedbackStatus, description: '피드백 상태' })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
