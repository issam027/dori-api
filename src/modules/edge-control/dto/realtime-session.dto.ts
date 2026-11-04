import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class RealtimeSessionDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 1000 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  queueIds: string[] = [];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  localStatus = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  installations = false;

  @ApiPropertyOptional({
    enum: ['none', 'direct', 'replicated'],
    default: 'none',
  })
  @IsOptional()
  @IsIn(['none', 'direct', 'replicated'])
  tracking: 'none' | 'direct' | 'replicated' = 'none';

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (value: RealtimeSessionDto) =>
      value.tracking === 'direct' || value.trackingQueueId !== undefined,
  )
  @IsUUID('4')
  trackingQueueId?: string;
}
