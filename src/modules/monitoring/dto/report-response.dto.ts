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
    description: 'Total de rendez-vous honorés ou prévus',
  })
  totalAppointment: number;

  @ApiProperty({ example: 75, description: 'Total de clients servis' })
  totalServed: number;

  @ApiProperty({
    example: 5,
    description: 'Total de clients absents (no-show)',
  })
  totalNoShow: number;

  @ApiProperty({
    example: 3,
    description: "Total d'inscriptions expirées en fin de journée",
  })
  totalExpired: number;

  @ApiProperty({ example: 2, description: "Total d'inscriptions annulées" })
  totalCancelled: number;

  @ApiProperty({
    example: 12.5,
    nullable: true,
    description: "Temps d'attente moyen de la journée en minutes",
  })
  avgWaitMinutes: number | null;

  @ApiProperty({
    example: 7.2,
    nullable: true,
    description: 'Temps de service moyen de la journée en minutes',
  })
  avgServiceMinutes: number | null;
}

export class QueuePeriodVolumesResponseDto {
  @ApiProperty({
    example: '2026-10-01',
    description: 'Date de début de période (YYYY-MM-DD)',
  })
  startDate: string;

  @ApiProperty({
    example: '2026-10-07',
    description: 'Date de fin de période (YYYY-MM-DD)',
  })
  endDate: string;

  @ApiProperty({
    example: 10,
    description: "ID de la file d'attente supervisée",
  })
  queueId: number;

  @ApiProperty({
    type: Object,
    additionalProperties: {
      $ref: '#/components/schemas/DailyQueueVolumeItemDto',
    },
    description:
      'Dictionnaire indexé par date (YYYY-MM-DD) contenant les métriques quotidiennes de volume',
    example: {
      '2026-10-01': {
        totalRegistered: 85,
        totalWalkin: 60,
        totalAppointment: 25,
        totalServed: 75,
        totalNoShow: 5,
        totalExpired: 3,
        totalCancelled: 2,
        avgWaitMinutes: 12.5,
        avgServiceMinutes: 7.2,
      },
    },
  })
  dailyVolumes: Record<string, DailyQueueVolumeItemDto>;
}
