import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  isUUID,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsTimeZone,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';

function IsUuidCsv(field: string): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isUuidCsv',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: `${field} must be a comma-separated list of UUIDs`,
      },
      validator: {
        validate: (value: unknown, _args: ValidationArguments) =>
          typeof value === 'string' &&
          value.length > 0 &&
          value
            .split(',')
            .map((item) => item.trim())
            .every((item) => isUUID(item)),
      },
    });
}

function IsEnumCsv(
  field: string,
  allowed: readonly string[],
): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isEnumCsv',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: { message: `${field} contains an unsupported value` },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          value.length > 0 &&
          value
            .split(',')
            .map((item) => item.trim())
            .every((item) => allowed.includes(item)),
      },
    });
}

const REGISTRATION_STATUSES = [
  'booked',
  'waiting',
  'in_progress',
  'served',
  'no_show',
  'expired',
  'cancelled',
] as const;
const ENTRY_TYPES = ['walkin', 'appointment'] as const;

export class ReportSeriesQueryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Site à superviser' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ type: String, example: '10,11' })
  @IsString()
  @IsUuidCsv('queueIds')
  @IsOptional()
  queueIds?: string;

  @ApiPropertyOptional({ type: String, example: '4,7' })
  @IsString()
  @IsUuidCsv('userIds')
  @IsOptional()
  userIds?: string;

  @ApiPropertyOptional({ type: String, example: '1,3' })
  @IsString()
  @IsUuidCsv('tierIds')
  @IsOptional()
  tierIds?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'served,no_show',
    description: `Valeurs autorisées : ${REGISTRATION_STATUSES.join(', ')}`,
  })
  @IsString()
  @IsEnumCsv('statuses', REGISTRATION_STATUSES)
  @IsOptional()
  statuses?: string;

  @ApiPropertyOptional({ type: String, example: 'walkin,appointment' })
  @IsString()
  @IsEnumCsv('entryTypes', ENTRY_TYPES)
  @IsOptional()
  entryTypes?: string;

  @ApiProperty({ example: '2026-10-01T00:00:00+02:00', format: 'date-time' })
  @IsISO8601({ strict: true })
  from: string;

  @ApiProperty({ example: '2026-11-01T00:00:00+01:00', format: 'date-time' })
  @IsISO8601({ strict: true })
  to: string;

  @ApiPropertyOptional({
    enum: ['hour', 'day', 'week', 'month'],
    default: 'day',
  })
  @IsIn(['hour', 'day', 'week', 'month'])
  @IsOptional()
  bucket: 'hour' | 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({
    example: 'Europe/Berlin',
    description: 'Fuseau IANA ; par défaut, celui du site',
  })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}
