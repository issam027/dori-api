import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class ServiceTierDetailDto {
  @ApiProperty({ example: 1, description: 'ID du forfait' })
  tierId: number;

  @ApiProperty({ example: 'standard', description: 'Code unique du forfait' })
  tierCode: string;

  @ApiProperty({ example: 'Standard', description: 'Nom du forfait' })
  tierName: string;

  @ApiProperty({ example: false, description: 'Forfait système réservé' })
  isSystem: boolean;

  @ApiPropertyOptional({
    example: 'Notification par SMS au franchissement de seuil',
    description: 'Description',
  })
  description?: string;

  @ApiProperty({ example: true, description: 'Statut actif' })
  isActive: boolean;
}

export class PaginatedServiceTierResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [ServiceTierDetailDto],
    description: 'Liste des forfaits',
  })
  items: ServiceTierDetailDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class QueueTierDetailDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 1, description: 'ID du forfait' })
  tierId: number;

  @ApiProperty({
    example: 0,
    description: 'Tarif appliqué (en devise de la file)',
  })
  price: number;

  @ApiProperty({ example: 'TND', minLength: 3, maxLength: 3 })
  currency: string;

  @ApiProperty({
    example: true,
    description: 'Indique si ce forfait est proposé par la file',
  })
  isEnabled: boolean;

  @ApiProperty({ example: true, description: 'Forfait sélectionné par défaut' })
  isDefault: boolean;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiPropertyOptional({
    type: ServiceTierDetailDto,
    description: 'Détails du forfait global',
  })
  tier?: ServiceTierDetailDto;
}

export class PaginatedQueueTierResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [QueueTierDetailDto],
    description: 'Liste des forfaits de la file',
  })
  items: QueueTierDetailDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class NotificationRuleDetailDto {
  @ApiProperty({ example: 10, description: 'ID de la règle de notification' })
  ruleId: number;

  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 1, description: 'ID du forfait' })
  tierId: number;

  @ApiProperty({
    example: 'threshold',
    enum: ['welcome', 'threshold', 'trakingLink'],
    description: 'Événement déclencheur',
  })
  notificationType: string;

  @ApiPropertyOptional({ example: 3, minimum: 0, nullable: true })
  thresholdPosition?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, nullable: true })
  thresholdMinutes?: number;

  @ApiProperty({
    example: 'sms',
    enum: ['sms', 'email'],
    description: 'Canal de diffusion',
  })
  channel: string;

  @ApiPropertyOptional({
    example: 'sms.threshold_reached',
    description: 'Clé du gabarit de traduction',
  })
  includeTrackingLink: boolean;

  @ApiProperty({ example: true, description: 'Règle active' })
  isActive: boolean;
}

export class PaginatedNotificationRuleResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [NotificationRuleDetailDto],
    description: 'Liste des règles de notification',
  })
  items: NotificationRuleDetailDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class TierDeleteResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'élément supprimé" })
  tierId?: number;

  @ApiPropertyOptional({ example: 1 })
  queueId?: number;

  @ApiPropertyOptional({ example: 1 })
  ruleId?: number;

  @ApiProperty({ example: true, description: 'Confirmation de suppression' })
  deleted: boolean;

  @ApiPropertyOptional({ example: true })
  removed?: boolean;
}
