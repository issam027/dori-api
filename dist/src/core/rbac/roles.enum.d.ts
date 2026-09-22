export declare enum RoleName {
    KIOSK = "kiosk",
    HOTESSE = "hotesse",
    MANAGER = "manager",
    ADMIN = "admin",
    ROOT = "root"
}
export declare const ROLE_RANKS: Record<string, number>;
export declare function canManageRole(sourceRoleRank: number, targetRoleRank: number, isRoot: boolean): boolean;
