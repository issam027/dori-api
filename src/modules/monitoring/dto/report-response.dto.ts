import { ApiProperty } from '@nestjs/swagger';

export class MonitoringSeriesMetricsDto {
  @ApiProperty({ example: 120 }) registered: number;
  @ApiProperty({ example: 92 }) served: number;
  @ApiProperty({ example: 5 }) noShow: number;
  @ApiProperty({ example: 8 }) cancelled: number;
  @ApiProperty({ example: 12.4, nullable: true })
  averageWaitMinutes: number | null;
  @ApiProperty({ type: Number, example: 9.2, nullable: true })
  medianWaitMinutes: number | null;
  @ApiProperty({ type: Number, example: 24.7, nullable: true })
  p90WaitMinutes: number | null;
  @ApiProperty({ example: 7.8, nullable: true })
  averageServiceMinutes: number | null;
  @ApiProperty({ type: Number, example: 6.5, nullable: true })
  medianServiceMinutes: number | null;
  @ApiProperty({ type: Number, example: 14.3, nullable: true })
  p90ServiceMinutes: number | null;
}

export class MonitoringSeriesBucketDto extends MonitoringSeriesMetricsDto {
  @ApiProperty({ format: 'date-time' }) periodStart: string;
}

export class MonitoringQueueBreakdownDto extends MonitoringSeriesMetricsDto {
  @ApiProperty() queueId: string;
  @ApiProperty() queueName: string;
  @ApiProperty({ type: [MonitoringSeriesBucketDto] })
  series: MonitoringSeriesBucketDto[];
}

export class MonitoringUserBreakdownDto {
  @ApiProperty() userId: string;
  @ApiProperty() displayName: string;
  @ApiProperty() registered: number;
  @ApiProperty() served: number;
  @ApiProperty() noShow: number;
  @ApiProperty({ nullable: true }) averageServiceMinutes: number | null;
}

export class MonitoringTierBreakdownDto {
  @ApiProperty() tierId: string;
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
  @ApiProperty({ required: false }) siteId?: string;
  @ApiProperty({ type: [Number], required: false }) queueIds?: string[];
  @ApiProperty({ type: [Number], required: false }) userIds?: string[];
  @ApiProperty({ type: [Number], required: false }) tierIds?: string[];
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
