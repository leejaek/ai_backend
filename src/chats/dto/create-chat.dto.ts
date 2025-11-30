import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum AllowedModel {
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',
}

export class CreateChatDto {
  @ApiProperty({ example: 'NestJS에서 JWT 인증을 구현하는 방법을 알려주세요.' })
  @IsString()
  @IsNotEmpty({ message: '질문은 필수 항목입니다.' })
  question: string;

  @ApiPropertyOptional({
    enum: AllowedModel,
    example: 'gpt-4o-mini',
    description: '사용할 AI 모델',
    default: 'gpt-4o-mini',
  })
  @IsEnum(AllowedModel, { message: '허용되지 않은 모델입니다.' })
  @IsOptional()
  model?: AllowedModel;

  @ApiPropertyOptional({
    example: false,
    description: 'true일 경우 SSE 스트리밍으로 응답',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isStreaming?: boolean;
}
