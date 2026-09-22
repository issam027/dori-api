import { PrismaService } from '../../core/database/prisma.service';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    check(): Promise<{
        status: string;
        timestamp: string;
        services: {
            database: string;
            api: string;
        };
    }>;
}
