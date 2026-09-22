import { Injectable } from '@nestjs/common';
import { toZonedTime, format } from 'date-fns-tz';

@Injectable()
export class ClockService {
  /**
   * Retourne l'instant courant en UTC
   */
  now(): Date {
    return new Date();
  }

  /**
   * Calcule la date métier (YYYY-MM-DD) dans le fuseau horaire du site (§4.8)
   */
  getBusinessDate(timezone: string = 'Africa/Tunis', date: Date = this.now()): string {
    const zoned = toZonedTime(date, timezone);
    return format(zoned, 'yyyy-MM-dd', { timeZone: timezone });
  }

  /**
   * Retourne la fin de la journée métier (23:59:59.999) dans le fuseau horaire du site en UTC Date (§4.14)
   */
  getEndOfBusinessDay(timezone: string = 'Africa/Tunis', date: Date = this.now()): Date {
    const dateStr = this.getBusinessDate(timezone, date);
    // On calcule 23:59:59 dans le fuseau du site
    const endOfDayStr = `${dateStr}T23:59:59.999`;
    // Date standard
    return new Date(`${endOfDayStr}Z`);
  }

  /**
   * Calcule la différence en minutes entre deux dates
   */
  diffInMinutes(dateA: Date, dateB: Date): number {
    return Math.max(0, Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60)));
  }
}
