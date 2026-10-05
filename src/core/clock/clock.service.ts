import { Injectable } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Centralises all "now" and business-date logic.
 * No module may call `new Date()` directly; use this service instead.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  nowUtc(): Date {
    return this.now();
  }

  parse(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  parseInTimezone(value: string, timezone: string): Date {
    return /(Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? this.parse(value)
      : fromZonedTime(value, timezone);
  }

  fromZonedTime(value: string, timezone: string): Date {
    return fromZonedTime(value, timezone);
  }

  addMilliseconds(date: Date, milliseconds: number): Date {
    return new Date(date.getTime() + milliseconds);
  }

  addMinutes(date: Date, minutes: number): Date {
    return this.addMilliseconds(date, minutes * 60_000);
  }

  addDays(date: Date, days: number): Date {
    return this.addMilliseconds(date, days * 86_400_000);
  }

  /**
   * Returns the current business date (YYYY-MM-DD) in the given IANA timezone.
   * e.g. businessDate('Africa/Tunis') → '2026-09-19'
   */
  businessDate(timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.now());
  }

  todayInTimezone(timezone: string): string {
    return this.businessDate(timezone);
  }

  tomorrowInTimezone(timezone: string): string {
    const todayStr = this.businessDate(timezone);
    const [y, m, d] = todayStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + 1));
    return date.toISOString().split('T')[0];
  }

  yesterdayInTimezone(timezone: string): string {
    const todayStr = this.businessDate(timezone);
    const [y, m, d] = todayStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d - 1));
    return date.toISOString().split('T')[0];
  }

  dateInTimezone(date: Date | string, timezone: string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /**
   * Returns the end-of-business-day (23:59:59.999) in UTC
   * for the given timezone on the given business date string (YYYY-MM-DD).
   */
  endOfBusinessDay(businessDate: string, timezone: string): Date {
    return fromZonedTime(`${businessDate}T23:59:59.999`, timezone);
  }

  endOfDayInTimezone(businessDate: string, timezone: string): Date {
    return this.endOfBusinessDay(businessDate, timezone);
  }

  minutesSince(past: Date): number {
    return (this.now().getTime() - past.getTime()) / 60_000;
  }
}
