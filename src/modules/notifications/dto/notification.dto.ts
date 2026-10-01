import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class SendManualNotificationDto {
  @ApiProperty({
    description: 'ID de la personne / client destinataire',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  customerId: number;

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
    enum: ['pending', 'sent', 'delivered', 'failed'],
    description: 'Filtrer par statut',
  })
  @IsIn(['pending', 'sent', 'delivered', 'failed'])
  @IsOptional()
  status?: 'pending' | 'sent' | 'delivered' | 'failed';

  @ApiPropertyOptional({
    example: '2026-09-27',
    description: 'Date métier (YYYY-MM-DD)',
  })
  @IsString()
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
