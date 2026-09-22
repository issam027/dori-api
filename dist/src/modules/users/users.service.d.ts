import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto, ResetUserPasswordDto } from './dto/user.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
export declare class UsersService {
    private readonly prisma;
    private readonly scopeService;
    private readonly clockService;
    constructor(prisma: PrismaService, scopeService: ScopeService, clockService: ClockService);
    private getMaxRank;
    private validateAntiEscalation;
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
    findById(user: UserContext, targetUserId: number): Promise<{
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
    create(caller: UserContext, dto: CreateUserDto): Promise<{
        userId: number;
        username: string;
        email: string | null;
        userType: string;
        roles: string[];
    }>;
    update(caller: UserContext, targetUserId: number, dto: UpdateUserDto): Promise<{
        userId: number;
        username: string;
        email: string | null;
        userType: string;
        languagePreference: string;
    }>;
    updateStatus(caller: UserContext, targetUserId: number, dto: UpdateUserStatusDto): Promise<{
        userId: number;
        isActive: boolean;
    }>;
    resetPassword(caller: UserContext, targetUserId: number, dto: ResetUserPasswordDto): Promise<{
        success: boolean;
        mustChangePassword: boolean;
    }>;
    assignRole(caller: UserContext, targetUserId: number, roleId: number): Promise<{
        success: boolean;
        roleId: number;
        roleName: string;
    }>;
    unassignRole(caller: UserContext, targetUserId: number, roleId: number): Promise<{
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
