import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class NotificationDetailDto {
  @ApiProperty({ example: 1, description: 'ID unique de la notification' })
  notificationId: number;

  @ApiProperty({
    example: 42,
    description: "ID de l'inscription client associée",
  })
  registrationId: number;

  @ApiProperty({
    enum: ['sms', 'email'],
    example: 'sms',
    description: 'Canal de diffusion',
  })
  channel: string;

  @ApiProperty({
    enum: ['welcome', 'threshold', 'trakingLink'],
    example: 'threshold',
    description: 'Type de notification',
  })
  notificationType: string;

  @ApiProperty({ example: 'fr', description: 'Code langue de la notification' })
  locale: string;

  @ApiPropertyOptional({
    example: '+21698123456',
    description: 'Destinataire (numéro de téléphone ou email)',
  })
  recipient?: string;

  @ApiProperty({
    example: 'Votre tour approche, vous êtes en 3ème position.',
    description: 'Contenu du message',
  })
  notificationContent: string;

  @ApiProperty({
    enum: ['pending', 'processing', 'sent', 'delivered', 'failed'],
    example: 'delivered',
    description: "Statut d'acheminement",
  })
  notificationStatus: string;

  @ApiProperty({ example: 1, description: "Nombre de tentatives d'envoi" })
  attemptCount: number;

  @ApiPropertyOptional({
    example: '2026-09-27T10:15:30.000Z',
    format: 'date-time',
    nullable: true,
    description: 'Date de remise confirmée par le webhook',
  })
  deliveredAt?: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: "Motif de l'échec éventuel",
  })
  failureReason?: string;

  @ApiProperty({
    example: '2026-09-27T10:14:00.000Z',
    format: 'date-time',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-27T10:15:30.000Z',
    format: 'date-time',
    description: 'Date de dernière mise à jour',
  })
  updatedAt: string;

  @ApiPropertyOptional({
    example: 'A042',
    description: 'Numéro de ticket du client',
  })
  ticketNumber?: string;

  @ApiPropertyOptional({ example: '2026-09-27', description: 'Date métier' })
  businessDate?: string;

  @ApiPropertyOptional({ example: 'Mohamed', description: 'Prénom du client' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Ben Ali', description: 'Nom du client' })
  lastName?: string;
}

export class PaginatedNotificationResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [NotificationDetailDto],
    description: 'Notifications trouvées',
  })
  items: NotificationDetailDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page courante' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 120, description: 'Nombre total de notifications' })
  total: number;

  @ApiProperty({ example: 5, description: 'Nombre total de pages' })
  totalPages: number;
}

export class WebhookResponseDto {
  @ApiProperty({ example: true, description: 'Accusé de réception du webhook' })
  received: boolean;
}
