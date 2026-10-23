import {
  IsUUID,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';
import {
  DATE_RANGE_LIMITS,
  IsCalendarDate,
  ValidDateRange,
} from '../../../core/dates/date-range.dto';

export class SendManualNotificationDto {
  @ApiProperty({
    description: 'ID de la personne / client destinataire',
    example: 1,
  })
  @IsUUID()
  @IsNotEmpty()
  registrationId: string;

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

@ValidDateRange(DATE_RANGE_LIMITS.notificationFilterDays)
export class NotificationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Filtrer par ID d'inscription" })
  @IsUUID()
  @IsOptional()
  registrationId?: string;

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
    format: 'date',
    description: 'Première date métier incluse. Doit être fournie avec dateTo.',
  })
  @IsCalendarDate()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    format: 'date',
    description:
      'Dernière date métier incluse. La période complète est limitée à 366 jours.',
  })
  @IsCalendarDate()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filtrer par file' })
  @IsUUID()
  @IsOptional()
  queueId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filtrer par site' })
  @IsUUID()
  @IsOptional()
  siteId?: string;
}

export class WebhookDeliveryDto {
  @ApiProperty({
    example: 'msg_01HXYZ...',
    description: 'Identifiant externe du message chez le provider',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
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
