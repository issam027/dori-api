import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/database/prisma.service';
import { ClockService } from '../../core/clock/clock.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly clockService;
    private readonly scopeService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, clockService: ClockService, scopeService: ScopeService);
    private hashToken;
    login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        mustChangePassword: boolean;
        user: {
            userId: number;
            username: string;
            email: string | null;
            roles: string[];
            permissions: string[];
            userType: string;
        };
    }>;
    refresh(dto: RefreshTokenDto, ipAddress?: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    logout(dto: RefreshTokenDto): Promise<{
        success: boolean;
    }>;
    getMe(userContext: UserContext): Promise<{
        roles: string[];
        permissions: string[];
        scope: {
            allSites: boolean;
            allowedSiteIds: number[] | null;
            allowedQueueIds: number[] | null;
        };
        userId: number;
        createdAt: Date;
        username: string;
        email: string | null;
        userType: string;
        languagePreference: string;
        mustChangePassword: boolean;
    }>;
    changePassword(userId: number, dto: ChangePasswordDto): Promise<{
        success: boolean;
    }>;
}
