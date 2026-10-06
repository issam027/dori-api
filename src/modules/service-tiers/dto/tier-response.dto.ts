import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class ServiceTierResponseDto {
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
    type: [ServiceTierResponseDto],
    description: 'Liste des forfaits',
  })
  items: ServiceTierResponseDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class QueueTierResponseDto {
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

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    minLength: 3,
    maxLength: 3,
    description: 'Surcharge persistée sur cette association',
  })
  currencyOverride?: string | null;

  @ApiProperty({
    enum: ['association', 'queue', 'site'],
    description: 'Niveau ayant fourni la devise effective',
  })
  currencyOrigin: 'association' | 'queue' | 'site';

  @ApiProperty({
    example: true,
    description: 'Indique si ce forfait est proposé par la file',
  })
  isActive: boolean;

  @ApiProperty({ example: true, description: 'Forfait sélectionné par défaut' })
  isDefault: boolean;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiPropertyOptional({
    type: ServiceTierResponseDto,
    description: 'Détails du forfait global',
  })
  tier?: ServiceTierResponseDto;
}

export class PaginatedQueueTierResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [QueueTierResponseDto],
    description: 'Liste des forfaits de la file',
  })
  items: QueueTierResponseDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class NotificationRuleResponseDto {
  @ApiProperty({ example: 10, description: 'ID de la règle de notification' })
  ruleId: number;

  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 1, description: 'ID du forfait' })
  tierId: number;

  @ApiProperty({
    example: 'threshold',
    enum: ['welcome', 'threshold'],
    description: 'Événement déclencheur',
  })
  notificationType: 'welcome' | 'threshold';

  @ApiPropertyOptional({ enum: ['position', 'estimatedTime'], nullable: true })
  thresholdType?: 'position' | 'estimatedTime' | null;

  @ApiPropertyOptional({ example: 3, minimum: 1, nullable: true })
  thresholdValue?: number | null;

  @ApiProperty({
    example: 'sms',
    enum: ['sms', 'email'],
    description: 'Canal de diffusion',
  })
  channel: string;

  @ApiProperty({
    example: true,
    description: 'Inclure ou non le lien public de suivi',
  })
  includeTrackingLink: boolean;

  @ApiProperty({ example: true, description: 'Règle active' })
  isActive: boolean;
}

export class PaginatedNotificationRuleResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [NotificationRuleResponseDto],
    description: 'Liste des règles de notification',
  })
  items: NotificationRuleResponseDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class DeleteTierResponseDto {
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
