import { ApiProperty } from '@nestjs/swagger';

export class DailyQueueVolumeItemDto {
  @ApiProperty({
    example: 85,
    description: "Total d'inscriptions enregistrées dans la journée",
  })
  totalRegistered: number;

  @ApiProperty({
    example: 60,
    description: "Total d'inscriptions sans rendez-vous (walkin)",
  })
  totalWalkin: number;

  @ApiProperty({
    example: 25,
    description: "Total d'inscriptions avec rendez-vous (appointment)",
  })
  totalAppointment: number;

  @ApiProperty({ example: 70, description: 'Total de clients servis' })
  totalServed: number;

  @ApiProperty({
    example: 5,
    description: 'Total de clients absents (no-show)',
  })
  totalNoShow: number;

  @ApiProperty({ example: 3, description: 'Total de rendez-vous expirés' })
  totalExpired: number;

  @ApiProperty({ example: 7, description: "Total d'annulations" })
  totalCancelled: number;

  @ApiProperty({
    example: 2,
    description:
      'Total non clôturées : en attente, en cours au guichet ou reportées.',
  })
  totalOpen: number;
}

export class DailyQueueKpisItemDto {
  @ApiProperty({
    example: 0.067,
    description: 'Taux de no-show (no_show / (served + no_show))',
  })
  noShowRate: number;

  @ApiProperty({
    example: 14.5,
    description: "Temps d'attente moyen en minutes",
  })
  averageWaitMinutes: number;

  @ApiProperty({
    example: 8.2,
    description: 'Durée moyenne de prise en charge au guichet en minutes',
  })
  averageServiceMinutes: number;
}

export class DailyQueueReportResponseDto {
  @ApiProperty({ example: 1, description: "ID de la file d'attente" })
  queueId: number;

  @ApiProperty({ example: 'A00', description: 'Code de la file' })
  queueCode: string;

  @ApiProperty({
    example: 'Consultation Générale',
    description: 'Nom de la file',
  })
  queueName: string;

  @ApiProperty({ example: 'Hôpital Aziza Othmana', description: 'Nom du site' })
  siteName: string;

  @ApiProperty({
    example: '2026-09-27',
    description: 'Date du rapport journalier (YYYY-MM-DD)',
  })
  businessDate: string;

  @ApiProperty({
    type: DailyQueueVolumeItemDto,
    description: 'Volumes journaliers',
  })
  volume: DailyQueueVolumeItemDto;

  @ApiProperty({
    type: DailyQueueKpisItemDto,
    description: 'Indicateurs clés de performance',
  })
  kpis: DailyQueueKpisItemDto;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({
    example: 3,
    description: 'Nombre de sites actifs dans le périmètre',
  })
  activeSites: number;

  @ApiProperty({ example: 8, description: "Nombre de files d'attente actives" })
  activeQueues: number;

  @ApiProperty({
    example: 42,
    description: 'Total de clients actuellement en attente',
  })
  waitingTotal: number;

  @ApiProperty({
    example: 30,
    description: 'Clients sans rendez-vous en attente',
  })
  waitingWalkin: number;

  @ApiProperty({
    example: 12,
    description: 'Clients sur rendez-vous en attente',
  })
  waitingAppointment: number;

  @ApiProperty({
    example: 25,
    description: "Nombre total de rendez-vous programmés pour aujourd'hui",
  })
  appointmentsToday: number;
}

export class DashboardQueueLoadItemDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 'A00', description: 'Code de la file' })
  queueCode: string;

  @ApiProperty({
    example: 'Consultation Générale',
    description: 'Nom de la file',
  })
  queueName: string;

  @ApiProperty({ example: 1, description: 'ID du site' })
  siteId: number;

  @ApiProperty({ example: 'Hôpital Aziza Othmana', description: 'Nom du site' })
  siteName: string;

  @ApiProperty({
    example: 'hybrid',
    enum: ['walkin', 'hybrid'],
    description: 'Type de gestion de la file',
  })
  queueType: string;

  @ApiProperty({ example: 15, description: 'Nombre de personnes en attente' })
  waitingCount: number;

  @ApiProperty({
    example: 'Standard',
    description: 'Forfait le plus représenté dans la file',
  })
  dominantTier: string;
}
