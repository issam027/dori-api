import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto/login.dto';
import { UserContext } from '../../core/rbac/scope.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, ipAddress: string, userAgent?: string): Promise<{
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
    refresh(dto: RefreshTokenDto, ipAddress: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    logout(dto: RefreshTokenDto): Promise<{
        success: boolean;
    }>;
    getMe(user: UserContext): Promise<{
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
