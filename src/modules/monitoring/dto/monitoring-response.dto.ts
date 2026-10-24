import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class MonitoringHealthResponseDto {
  @Expose()
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @Expose() @ApiProperty({ format: 'date-time' }) timestamp!: string;
}

export class MonitoringMetricsResponseDto {
  @Expose()
  @ApiProperty({ type: Object, additionalProperties: { type: 'number' } })
  counters!: Record<string, number>;

  @Expose()
  @ApiProperty({
    example: { averageHttpRequestDurationMs: 12.5 },
  })
  derived!: { averageHttpRequestDurationMs: number };

  @Expose() @ApiProperty({ format: 'date-time' }) generatedAt!: string;
}

export class MonitoringActivityResponseDto {
  @Expose()
  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
    description:
      'Notifications pending/processing et failed sur les dernières 24 heures',
    example: { pending: 4, processing: 1, failed: 2 },
  })
  notifications!: Record<string, number>;

  @Expose()
  @ApiProperty({ description: 'Sessions opérateur actuellement ouvertes' })
  openOperatorSessions!: number;

  @Expose()
  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
    description: 'Inscriptions non terminées, tous sites confondus',
    example: { booked: 8, waiting: 12, in_progress: 3 },
  })
  registrations!: Record<string, number>;

  @Expose() @ApiProperty({ format: 'date-time' }) generatedAt!: string;
}

export class MonitoringLiveTotalsDto {
  @ApiProperty() waiting: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() activeQueues: number;
  @ApiProperty() openDesks: number;
  @ApiProperty() activeOperators: number;
  @ApiProperty({ nullable: true }) longestWaitMinutes: number | null;
}

export class MonitoringLiveQueueDto {
  @ApiProperty() queueId: string;
  @ApiProperty() queueName: string;
  @ApiProperty() waiting: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() openDesks: number;
  @ApiProperty() activeOperators: number;
  @ApiProperty({ nullable: true }) estimatedWaitMinutes: number | null;
  @ApiProperty({ nullable: true }) longestWaitMinutes: number | null;
}

export class MonitoringLiveOperatorDto {
  @ApiProperty() userId: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ type: [Number] }) queueIds: string[];
  @ApiProperty() sessionId: string;
  @ApiProperty({ required: false }) counterName?: string;
  @ApiProperty({ required: false }) threadNumber?: number;
  @ApiProperty({ format: 'date-time' }) startedAt: string;
  @ApiProperty({ required: false }) currentRegistrationId?: string;
  @ApiProperty({ required: false }) currentTicketNumber?: string;
}

export class MonitoringLiveAlertDto {
  @ApiProperty() code: string;
  @ApiProperty({ enum: ['info', 'warning', 'critical'] }) severity: string;
  @ApiProperty({ required: false }) queueId?: string;
  @ApiProperty() messageKey: string;
  @ApiProperty({ type: Object, required: false })
  translationParams?: Record<string, string | number>;
}

export class MonitoringLiveResponseDto {
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
  @ApiProperty() siteId: string;
  @ApiProperty() timezone: string;
  @ApiProperty({ type: MonitoringLiveTotalsDto })
  totals: MonitoringLiveTotalsDto;
  @ApiProperty({ type: [MonitoringLiveQueueDto] })
  queues: MonitoringLiveQueueDto[];
  @ApiProperty({ type: [MonitoringLiveOperatorDto] })
  operators: MonitoringLiveOperatorDto[];
  @ApiProperty({ type: [MonitoringLiveAlertDto] })
  alerts: MonitoringLiveAlertDto[];
}
