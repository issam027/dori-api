import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto, ResetUserPasswordDto, AssignRoleDto } from './dto/user.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { UserContext } from '../../core/rbac/scope.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(user: UserContext, pagination: PaginationQueryDto, userType?: string): Promise<import("../../core/pagination/pagination.dto").PaginatedResult<{
        roles: string[];
        userRoles: undefined;
        userId: number;
        isActive: boolean;
        createdAt: Date;
        username: string;
        email: string | null;
        userType: string;
        languagePreference: string;
        lastLogin: Date | null;
    }>>;
    create(user: UserContext, dto: CreateUserDto): Promise<{
        userId: number;
        username: string;
        email: string | null;
        userType: string;
        roles: string[];
    }>;
    findById(user: UserContext, userId: number): Promise<{
        userId: number;
        username: string;
        email: string | null;
        userType: string;
        isActive: boolean;
        languagePreference: string;
        lastLogin: Date | null;
        createdAt: Date;
        roles: string[];
        assignedSites: {
            siteId: number;
            siteName: string;
        }[];
        assignedQueues: {
            queueId: number;
            queueCode: string;
            queueName: string | null;
        }[];
    }>;
    update(user: UserContext, userId: number, dto: UpdateUserDto): Promise<{
        userId: number;
        username: string;
        email: string | null;
        userType: string;
        languagePreference: string;
    }>;
    updateStatus(user: UserContext, userId: number, dto: UpdateUserStatusDto): Promise<{
        userId: number;
        isActive: boolean;
    }>;
    resetPassword(user: UserContext, userId: number, dto: ResetUserPasswordDto): Promise<{
        success: boolean;
        mustChangePassword: boolean;
    }>;
    assignRole(user: UserContext, userId: number, dto: AssignRoleDto): Promise<{
        success: boolean;
        roleId: number;
        roleName: string;
    }>;
    unassignRole(user: UserContext, userId: number, roleId: number): Promise<{
        success: boolean;
    }>;
    findAllRoles(): Promise<({
        rolePermissions: ({
            permission: {
                isActive: boolean;
                createdAt: Date;
                description: string | null;
                permissionId: number;
                permissionName: string;
            };
        } & {
            assignedAt: Date;
            roleId: number;
            permissionId: number;
        })[];
    } & {
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        roleId: number;
        roleName: string;
        rank: number;
    })[]>;
}
