export declare class CreateSiteDto {
    siteName: string;
    siteLocation?: string;
    siteLogoUrl?: string;
    siteType?: string;
    timezone?: string;
    defaultCurrency?: string;
    defaultAppointmentsEnabled?: boolean;
    defaultAppointmentSlotDuration?: number;
    defaultSlotCapacity?: number;
    defaultWorkingHoursStart?: string;
    defaultWorkingHoursEnd?: string;
    defaultBreakStart?: string;
    defaultBreakEnd?: string;
    defaultLateToleranceMinutes?: number;
    defaultCarryOverWaiting?: boolean;
    defaultDailyResetMode?: string;
    defaultDailyResetTime?: string;
    defaultLocale?: string;
}
export declare class UpdateSiteDto {
    siteName?: string;
    siteLocation?: string;
    siteLogoUrl?: string;
    siteType?: string;
    timezone?: string;
    defaultCurrency?: string;
    defaultAppointmentsEnabled?: boolean;
    defaultAppointmentSlotDuration?: number;
    defaultSlotCapacity?: number;
    defaultWorkingHoursStart?: string;
    defaultWorkingHoursEnd?: string;
    defaultBreakStart?: string;
    defaultBreakEnd?: string;
    defaultLateToleranceMinutes?: number;
    defaultCarryOverWaiting?: boolean;
    defaultDailyResetMode?: string;
    defaultDailyResetTime?: string;
    defaultLocale?: string;
}
export declare class AssignManagerDto {
    userId: number;
}
