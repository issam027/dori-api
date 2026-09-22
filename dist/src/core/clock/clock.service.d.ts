export declare class ClockService {
    now(): Date;
    getBusinessDate(timezone?: string, date?: Date): string;
    getEndOfBusinessDay(timezone?: string, date?: Date): Date;
    diffInMinutes(dateA: Date, dateB: Date): number;
}
