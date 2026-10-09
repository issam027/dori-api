import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class SendManualNotificationDto {
  @ApiProperty({
    description: 'ID de la personne / client destinataire',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  registrationId: number;

  @ApiProperty({
    enum: ['sms', 'email'],
    example: 'sms',
    description: 'Canal de diffusion',
  })
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @ApiProperty({
    example: 'Votre tour approche, veuillez vous présenter au guichet.',
    description: 'Texte du message',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    example: '+21698123456',
    description: 'Numéro ou adresse de substitution',
  })
  @IsString()
  @IsOptional()
  recipient?: string;
}

export class NotificationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filtrer par ID d'inscription" })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  registrationId?: number;

  @ApiPropertyOptional({
    enum: ['sms', 'email'],
    description: 'Filtrer par canal',
  })
  @IsIn(['sms', 'email'])
  @IsOptional()
  channel?: 'sms' | 'email';

  @ApiPropertyOptional({
    enum: ['pending', 'processing', 'sent', 'delivered', 'failed'],
    description: 'Filtrer par statut',
  })
  @IsIn(['pending', 'processing', 'sent', 'delivered', 'failed'])
  @IsOptional()
  status?: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';

  @ApiPropertyOptional({
    example: '2026-09-27',
    description: 'Date métier (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  businessDate?: string;
}

export class WebhookDeliveryDto {
  @ApiProperty({
    example: 'msg_01HXYZ...',
    description: 'Identifiant externe du message chez le provider',
  })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({
    enum: ['delivered', 'failed'],
    example: 'delivered',
    description: 'Statut de remise',
  })
  @IsIn(['delivered', 'failed'])
  @IsNotEmpty()
  status: 'delivered' | 'failed';

  @ApiPropertyOptional({
    example: 'Invalid phone number format',
    description: 'Motif du rejet éventuel',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
