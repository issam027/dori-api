import { PrismaService } from '../database/prisma.service';
export interface UserContext {
    userId: number;
    roles: string[];
    permissions: string[];
    userType: string;
}
export declare class ScopeService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    isSystemUser(user: UserContext): boolean;
    getAllowedSiteIds(user: UserContext): Promise<number[] | null>;
    getAllowedQueueIds(user: UserContext): Promise<number[] | null>;
    validateSiteScope(user: UserContext, siteId: number): Promise<void>;
    validateQueueScope(user: UserContext, queueId: number): Promise<void>;
}
