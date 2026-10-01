import { Injectable } from '@nestjs/common';

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
    return new Date();
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
    }).format(new Date());
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
    // Build an end-of-day string in the target timezone then convert
    const eodLocal = `${businessDate}T23:59:59`;
    // Use Intl to resolve the offset
    const refDate = new Date(`${businessDate}T12:00:00`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    // Get UTC offset in minutes for this date in the timezone
    const parts = formatter.formatToParts(refDate);
    const p: Record<string, string> = {};
    for (const { type, value } of parts) p[type] = value;
    const localDate = new Date(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`,
    );
    const offsetMs = refDate.getTime() - localDate.getTime();
    // Build end-of-day in UTC
    const eod = new Date(`${eodLocal}Z`);
    eod.setTime(eod.getTime() + offsetMs);
    return eod;
  }

  endOfDayInTimezone(businessDate: string, timezone: string): Date {
    return this.endOfBusinessDay(businessDate, timezone);
  }

  minutesSince(past: Date): number {
    return (this.now().getTime() - past.getTime()) / 60_000;
  }
}
