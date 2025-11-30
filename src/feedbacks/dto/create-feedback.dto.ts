import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsBoolean } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({ description: '피드백 대상 대화 ID' })
  @IsUUID()
  chatId: string;

  @ApiProperty({ description: '긍정 피드백 여부' })
  @IsBoolean()
  isPositive: boolean;
}
