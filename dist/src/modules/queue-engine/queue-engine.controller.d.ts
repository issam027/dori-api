import { QueueEngineService } from './queue-engine.service';
import { OpenSessionDto } from './dto/session.dto';
import { UserContext } from '../../core/rbac/scope.service';
export declare class QueueEngineController {
    private readonly queueEngineService;
    constructor(queueEngineService: QueueEngineService);
    openSession(user: UserContext, queueId: number, dto: OpenSessionDto): Promise<{
        code: string;
        translationKey: string;
        translationParams: {
            threadNumber: number | undefined;
        };
        data: {
            sessionId: number;
            queueId: number;
            userId: number;
            threadNumber: number | null;
            mode: string;
            connectedAt: string;
            takenOverFromSessionId: number | null;
            reassignedRegistrationId: number | null;
        };
    } | {
        code: string;
        translationKey: string;
        translationParams: {};
        data: {
            sessionId: number;
            queueId: number;
            userId: number;
            threadNumber: null;
            mode: string;
            connectedAt: string;
        };
    }>;
    closeSession(user: UserContext, queueId: number, sessionId: number): Promise<{
        success: boolean;
    }>;
    callNext(user: UserContext, queueId: number): Promise<{
        code: string;
        translationKey: string;
        translationParams: {
            ticketNumber?: undefined;
        };
        data: null;
    } | {
        code: string;
        translationKey: string;
        translationParams: {
            ticketNumber: string;
        };
        data: {
            registrationId: number;
            ticketNumber: string;
            entryType: string;
            scheduledTime: string | null;
            calledEarly: boolean;
            tier: {
                tierId: number;
                tierCode: string;
                tierName: string;
            };
            status: string;
            sessionId: number;
            threadNumber: number | null;
            priorityScore: number;
            calledAt: string | undefined;
            person: {
                personId: number;
                firstName: string | null;
                lastName: string | null;
                phone: string | null;
                hasNotes: boolean;
            };
        };
    }>;
    markServed(user: UserContext, registrationId: number): Promise<{
        code: string;
        translationKey: string;
        translationParams: {};
        data: {
            registrationId: number;
            status: string;
            servedAt: string | undefined;
            closedAt: string | undefined;
            handledBySessionId: number | null;
            handledByUserId: number;
        };
    }>;
    markNoShow(user: UserContext, registrationId: number): Promise<{
        code: string;
        translationKey: string;
        translationParams: {};
        data: {
            registrationId: number;
            status: string;
            servedAt: null;
            closedAt: string | undefined;
            handledBySessionId: number | null;
            handledByUserId: number;
        };
    }>;
}
