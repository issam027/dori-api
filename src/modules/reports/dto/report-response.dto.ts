import { ApiProperty } from '@nestjs/swagger';

export class ReportVolumeDto {
  @ApiProperty() registered: number;
  @ApiProperty() walkin: number;
  @ApiProperty() appointments: number;
  @ApiProperty() served: number;
  @ApiProperty() noShow: number;
  @ApiProperty() expired: number;
  @ApiProperty() cancelled: number;
}

export class ReportTimingDto {
  @ApiProperty({ nullable: true }) averageWaitMinutes: number | null;
  @ApiProperty({ nullable: true }) medianWaitMinutes: number | null;
  @ApiProperty({ nullable: true }) p90WaitMinutes: number | null;
  @ApiProperty({ nullable: true }) averageServiceMinutes: number | null;
  @ApiProperty({ nullable: true }) medianServiceMinutes: number | null;
  @ApiProperty({ nullable: true }) p90ServiceMinutes: number | null;
}

export class ReportRatesDto {
  @ApiProperty({ nullable: true }) noShowRate: number | null;
  @ApiProperty({ nullable: true }) cancellationRate: number | null;
  @ApiProperty({ nullable: true }) expirationRate: number | null;
}

export class ReportMetricsDto {
  @ApiProperty({ type: ReportVolumeDto }) volume: ReportVolumeDto;
  @ApiProperty({ type: ReportTimingDto }) timing: ReportTimingDto;
  @ApiProperty({ type: ReportRatesDto }) rates: ReportRatesDto;
}

export class ReportBucketDto extends ReportMetricsDto {
  @ApiProperty({ format: 'date' }) periodStart: string;
  @ApiProperty({ format: 'date' }) periodEnd: string;
}

export class ReportPeriodDto {
  @ApiProperty({ format: 'date' }) dateFrom: string;
  @ApiProperty({ format: 'date' }) dateTo: string;
  @ApiProperty({ enum: ['day', 'week', 'month'] }) granularity: string;
}

export class ReportGroupDto extends ReportMetricsDto {
  @ApiProperty({ type: 'object' }) dimension: Record<string, unknown>;
  @ApiProperty({ type: [ReportBucketDto] }) buckets: ReportBucketDto[];
  @ApiProperty({ nullable: true }) timezone: string | null;
}

export class ReportSeriesResponseDto {
  @ApiProperty({ type: 'object' }) scope: Record<string, unknown>;
  @ApiProperty({ nullable: true }) timezone: string | null;
  @ApiProperty({ type: ReportPeriodDto }) period: ReportPeriodDto;
  @ApiProperty({ type: ReportMetricsDto }) summary: ReportMetricsDto;
  @ApiProperty({ type: [ReportBucketDto] }) buckets: ReportBucketDto[];
  @ApiProperty({ type: [ReportGroupDto], required: false })
  groups?: ReportGroupDto[];
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
