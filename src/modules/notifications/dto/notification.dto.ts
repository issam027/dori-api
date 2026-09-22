import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookNotificationDto {
  @ApiProperty({ example: 'msg_123456789' })
  @IsString()
  @IsNotEmpty()
  providerMessageId!: string;

  @ApiProperty({ enum: ['delivered', 'failed'] })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  failureReason?: string;
}
