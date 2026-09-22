import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GlobalTierResponseDto {
  @ApiProperty({ example: 1 })
  tierId!: number;

  @ApiProperty({ example: 'free' })
  tierCode!: string;

  @ApiProperty({ example: 'Gratuit / Standard' })
  tierName!: string;

  @ApiPropertyOptional({ example: 'Accès sans frais avec notification SMS basique', nullable: true })
  description?: string | null;

  @ApiProperty({ example: true, description: 'Indique si le forfait est natif système (non supprimable)' })
  isSystem!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  updatedAt!: Date;
}

export class NotificationRuleResponseDto {
  @ApiProperty({ example: 1 })
  ruleId!: number;

  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 2 })
  tierId!: number;

  @ApiProperty({ example: 'threshold', enum: ['confirmation', 'threshold', 'called'] })
  notificationType!: string;

  @ApiProperty({ example: 'sms', enum: ['sms', 'email', 'voice'] })
  channel!: string;

  @ApiPropertyOptional({ example: 3, nullable: true, description: 'Seuil en position dans la file' })
  thresholdPosition?: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true, description: 'Seuil en minutes avant RDV' })
  thresholdMinutes?: number | null;

  @ApiProperty({ example: true })
  includeTrackingLink!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class QueueTierResponseDto {
  @ApiProperty({ example: 2 })
  tierId!: number;

  @ApiProperty({ example: 'premium' })
  tierCode!: string;

  @ApiProperty({ example: 'Forfait VIP' })
  tierName!: string;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ example: 10.5, description: 'Tarif en devise locale' })
  price!: number;

  @ApiProperty({ example: 'TND' })
  currency!: string;

  @ApiProperty({ example: 1 })
  displayOrder!: number;

  @ApiProperty({ type: [NotificationRuleResponseDto] })
  notificationRules!: NotificationRuleResponseDto[];
}

export class DisplayCurrentCallDto {
  @ApiPropertyOptional({ example: 1, nullable: true })
  threadNumber!: number | null;

  @ApiProperty({ example: 'A-015' })
  ticketNumber!: string;
}

export class QueueDisplayScreenResponseDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 'MED-01' })
  queueCode!: string;

  @ApiPropertyOptional({ example: 'Médecine Générale', nullable: true })
  queueName?: string | null;

  @ApiProperty({ type: [DisplayCurrentCallDto], description: 'Appels en cours par guichet' })
  currentCalls!: DisplayCurrentCallDto[];

  @ApiProperty({ example: ['A-016', 'A-017', 'A-018'], isArray: true, description: 'Prochains tickets en attente' })
  nextTickets!: string[];
}
