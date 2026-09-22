export declare class AuthUserSummaryDto {
    userId: number;
    username: string;
    email?: string | null;
    roles: string[];
    permissions: string[];
    userType: string;
}
export declare class LoginResponseDto {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    mustChangePassword: boolean;
    user: AuthUserSummaryDto;
}
export declare class RefreshResponseDto {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export declare class UserScopeDto {
    allSites: boolean;
    allowedSiteIds: number[];
    allowedQueueIds: number[];
}
export declare class UserMeResponseDto {
    userId: number;
    username: string;
    email?: string | null;
    userType: string;
    languagePreference: string;
    mustChangePassword: boolean;
    createdAt: Date;
    roles: string[];
    permissions: string[];
    scope: UserScopeDto;
}
export declare class ActionSuccessResponseDto {
    success: boolean;
}
