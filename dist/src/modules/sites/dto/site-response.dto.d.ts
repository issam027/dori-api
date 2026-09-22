export declare class SiteResponseDto {
    siteId: number;
    siteName: string;
    siteLocation?: string | null;
    siteLogoUrl?: string | null;
    siteType: string;
    timezone: string;
    defaultCurrency: string;
    isActive: boolean;
    defaultAppointmentsEnabled: boolean;
    defaultAppointmentSlotDuration: number;
    defaultSlotCapacity: number;
    defaultWorkingHoursStart: string;
    defaultWorkingHoursEnd: string;
    defaultBreakStart?: string | null;
    defaultBreakEnd?: string | null;
    defaultLateToleranceMinutes: number;
    defaultCarryOverWaiting: boolean;
    defaultDailyResetMode: string;
    defaultDailyResetTime: string;
    defaultLocale: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class SiteManagerDto {
    userId: number;
    username: string;
    email?: string | null;
    userType: string;
}
export declare class SiteManagerAssignmentResponseDto {
    userId: number;
    siteId: number;
    assignedAt: Date;
}
