import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTierDto {
  @ApiProperty({ example: 'vip' })
  @IsString()
  @IsNotEmpty()
  tierCode!: string;

  @ApiProperty({ example: 'VIP' })
  @IsString()
  @IsNotEmpty()
  tierName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssociateQueueTierDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @IsNotEmpty()
  tierId!: number;

  @ApiProperty({ example: 1.5, default: 0 })
  @IsNumber()
  @Min(0)
  price: number = 0;

  @ApiPropertyOptional({ default: 'TND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class UpdateQueueTierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class CreateNotificationRuleDto {
  @ApiProperty({ enum: ['welcome', 'threshold'] })
  @IsIn(['welcome', 'threshold'])
  notificationType!: string;

  @ApiProperty({ enum: ['sms', 'voice_call', 'email'] })
  @IsIn(['sms', 'voice_call', 'email'])
  channel!: string;

  @ApiPropertyOptional({ description: 'Déclenche quand position <= N' })
  @IsOptional()
  @IsInt()
  thresholdPosition?: number;

  @ApiPropertyOptional({ description: 'Déclenche quand attente estimée <= N minutes' })
  @IsOptional()
  @IsInt()
  thresholdMinutes?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeTrackingLink?: boolean;
}

export class UpdateNotificationRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  thresholdPosition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  thresholdMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeTrackingLink?: boolean;
}
