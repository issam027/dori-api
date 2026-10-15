import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class HealthMemoryUsageDto {
  @Expose() @ApiProperty() rss!: number;
  @Expose() @ApiProperty() heapTotal!: number;
  @Expose() @ApiProperty() heapUsed!: number;
  @Expose() @ApiProperty() external!: number;
  @Expose() @ApiProperty() arrayBuffers!: number;
}

export class HealthChecksDto {
  @Expose()
  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';

  @Expose()
  @ApiProperty({ type: HealthMemoryUsageDto })
  memoryUsage!: HealthMemoryUsageDto;
}

export class MonitoringHealthResponseDto {
  @Expose()
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @Expose() @ApiProperty({ format: 'date-time' }) timestamp!: string;
  @Expose() @ApiProperty() uptime!: number;
  @Expose() @ApiProperty({ type: HealthChecksDto }) checks!: HealthChecksDto;
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
  @ApiProperty({ type: Object, additionalProperties: { type: 'number' } })
  notifications!: Record<string, number>;

  @Expose() @ApiProperty() openOperatorSessions!: number;

  @Expose()
  @ApiProperty({ type: Object, additionalProperties: { type: 'number' } })
  registrations!: Record<string, number>;

  @Expose() @ApiProperty({ format: 'date-time' }) generatedAt!: string;
}
