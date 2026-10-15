import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const DATE_RANGE_LIMITS = {
  availabilityDetailedDays: 62,
  availabilitySummaryDays: 366,
  synchronousReportingDays: 366,
  registrationFilterDays: 366,
  notificationFilterDays: 366,
} as const;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;

function calendarDayNumber(value: string): number | null {
  if (!CALENDAR_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp / MILLISECONDS_PER_DAY;
}

export function inclusiveCalendarDayCount(
  dateFrom: string,
  dateTo: string,
): number | null {
  const from = calendarDayNumber(dateFrom);
  const to = calendarDayNumber(dateTo);
  if (from === null || to === null || from > to) return null;
  return to - from + 1;
}

export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: '$property must be a valid calendar date in YYYY-MM-DD format',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && calendarDayNumber(value) !== null,
      },
    });
}

export function ValidDateRange(maxDays: number): ClassDecorator {
  return (target) =>
    registerDecorator({
      name: 'validDateRange',
      target: target as unknown as new (...args: never[]) => unknown,
      propertyName: '_dateRange',
      constraints: [maxDays],
      options: {
        message: `dateFrom and dateTo must be provided together, dateFrom must be before or equal to dateTo, and the inclusive range must not exceed ${maxDays} days`,
      },
      validator: {
        validate: (_value: unknown, args: ValidationArguments) => {
          const value = args.object as Record<string, unknown>;
          if (value.dateFrom == null && value.dateTo == null) return true;
          if (
            typeof value.dateFrom !== 'string' ||
            typeof value.dateTo !== 'string'
          ) {
            return false;
          }
          const days = inclusiveCalendarDayCount(value.dateFrom, value.dateTo);
          return days !== null && days <= maxDays;
        },
      },
    });
}

@ValidDateRange(DATE_RANGE_LIMITS.synchronousReportingDays)
export class DateRangeQueryDto {
  @ApiProperty({
    example: '2026-09-01',
    format: 'date',
    description: 'Première date calendaire incluse (YYYY-MM-DD)',
  })
  @IsNotEmpty()
  @IsCalendarDate()
  dateFrom: string;

  @ApiProperty({
    example: '2026-09-30',
    format: 'date',
    description:
      'Dernière date calendaire incluse (YYYY-MM-DD). La plage doit être ordonnée et respecter la limite propre à l’opération.',
  })
  @IsNotEmpty()
  @IsCalendarDate()
  dateTo: string;
}
