import { ApiProperty } from '@nestjs/swagger';

export class MonitoringSeriesMetricsDto {
  @ApiProperty({ example: 120 }) registered: number;
  @ApiProperty({ example: 92 }) served: number;
  @ApiProperty({ example: 5 }) noShow: number;
  @ApiProperty({ example: 8 }) cancelled: number;
  @ApiProperty({ example: 12.4, nullable: true })
  averageWaitMinutes: number | null;
  @ApiProperty({ example: 7.8, nullable: true })
  averageServiceMinutes: number | null;
}

export class MonitoringSeriesBucketDto extends MonitoringSeriesMetricsDto {
  @ApiProperty({ format: 'date-time' }) periodStart: string;
}

export class MonitoringQueueBreakdownDto extends MonitoringSeriesMetricsDto {
  @ApiProperty() queueId: number;
  @ApiProperty() queueName: string;
}

export class MonitoringUserBreakdownDto {
  @ApiProperty() userId: number;
  @ApiProperty() displayName: string;
  @ApiProperty() registered: number;
  @ApiProperty() served: number;
  @ApiProperty() noShow: number;
  @ApiProperty({ nullable: true }) averageServiceMinutes: number | null;
}

export class MonitoringTierBreakdownDto {
  @ApiProperty() tierId: number;
  @ApiProperty() tierCode: string;
  @ApiProperty() tierName: string;
  @ApiProperty() registered: number;
  @ApiProperty() served: number;
  @ApiProperty() noShow: number;
  @ApiProperty({ nullable: true }) averageWaitMinutes: number | null;
}

export class MonitoringCountBreakdownDto {
  @ApiProperty() entryType: string;
  @ApiProperty() count: number;
}

export class MonitoringStatusBreakdownDto {
  @ApiProperty() status: string;
  @ApiProperty() count: number;
}

export class MonitoringSeriesBreakdownsDto {
  @ApiProperty({ type: [MonitoringQueueBreakdownDto] })
  byQueue: MonitoringQueueBreakdownDto[];
  @ApiProperty({ type: [MonitoringUserBreakdownDto] })
  byUser: MonitoringUserBreakdownDto[];
  @ApiProperty({ type: [MonitoringTierBreakdownDto] })
  byTier: MonitoringTierBreakdownDto[];
  @ApiProperty({ type: [MonitoringCountBreakdownDto] })
  byEntryType: MonitoringCountBreakdownDto[];
  @ApiProperty({ type: [MonitoringStatusBreakdownDto] })
  byStatus: MonitoringStatusBreakdownDto[];
}

export class MonitoringAppliedFiltersDto {
  @ApiProperty({ format: 'date-time' }) from: string;
  @ApiProperty({ format: 'date-time' }) to: string;
  @ApiProperty({ enum: ['hour', 'day', 'week', 'month'] }) bucket: string;
  @ApiProperty({ required: false }) siteId?: number;
  @ApiProperty({ type: [Number], required: false }) queueIds?: number[];
  @ApiProperty({ type: [Number], required: false }) userIds?: number[];
  @ApiProperty({ type: [Number], required: false }) tierIds?: number[];
  @ApiProperty({ type: [String], required: false }) statuses?: string[];
  @ApiProperty({ type: [String], required: false }) entryTypes?: string[];
}

export class ReportSeriesResponseDto {
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
  @ApiProperty({ example: 'Europe/Berlin' }) timezone: string;
  @ApiProperty({ type: MonitoringAppliedFiltersDto })
  appliedFilters: MonitoringAppliedFiltersDto;
  @ApiProperty({ type: MonitoringSeriesMetricsDto })
  totals: MonitoringSeriesMetricsDto;
  @ApiProperty({ type: [MonitoringSeriesBucketDto] })
  series: MonitoringSeriesBucketDto[];
  @ApiProperty({ type: MonitoringSeriesBreakdownsDto })
  breakdowns: MonitoringSeriesBreakdownsDto;
}

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
