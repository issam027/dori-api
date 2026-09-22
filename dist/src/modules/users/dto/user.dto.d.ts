export declare class CreateUserDto {
    username: string;
    email?: string;
    password: string;
    userType?: string;
    roleName: string;
    languagePreference?: string;
}
export declare class UpdateUserDto {
    email?: string;
    languagePreference?: string;
}
export declare class UpdateUserStatusDto {
    isActive: boolean;
}
export declare class ResetUserPasswordDto {
    newPassword: string;
}
export declare class AssignRoleDto {
    roleId: number;
}
