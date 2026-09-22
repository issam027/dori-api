import { PrismaService } from '../core/database/prisma.service';
import { ClockService } from '../core/clock/clock.service';
export declare class NotificationWorkerService {
    private readonly prisma;
    private readonly clockService;
    private readonly logger;
    constructor(prisma: PrismaService, clockService: ClockService);
    processPendingNotifications(): Promise<void>;
}
