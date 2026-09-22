export declare class UserSummaryResponseDto {
    userId: number;
    username: string;
    email?: string | null;
    userType: string;
    isActive: boolean;
    languagePreference: string;
    lastLogin?: Date | null;
    createdAt: Date;
    roles: string[];
}
export declare class UserAssignedSiteDto {
    siteId: number;
    siteName: string;
}
export declare class UserAssignedQueueDto {
    queueId: number;
    queueCode: string;
    queueName?: string | null;
}
export declare class UserDetailResponseDto {
    userId: number;
    username: string;
    email?: string | null;
    userType: string;
    isActive: boolean;
    languagePreference: string;
    lastLogin?: Date | null;
    createdAt: Date;
    roles: string[];
    sites: UserAssignedSiteDto[];
    queues: UserAssignedQueueDto[];
}
export declare class PermissionDto {
    permissionId: number;
    permissionName: string;
    description?: string | null;
}
export declare class RolePermissionItemDto {
    permission: PermissionDto;
}
export declare class RoleResponseDto {
    roleId: number;
    roleName: string;
    rank: number;
    description?: string | null;
    isActive: boolean;
    rolePermissions: RolePermissionItemDto[];
}
export declare class RoleAssignmentResponseDto {
    success: boolean;
    roleId: number;
    roleName: string;
}
