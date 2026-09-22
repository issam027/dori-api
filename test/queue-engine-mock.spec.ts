import { QueueEngineService } from '../src/modules/queue-engine/queue-engine.service';
import { ErrorCode } from '../src/core/errors/error-codes.enum';
import { AppException } from '../src/core/errors/app.exception';

describe('Queue Engine - Gestion des guichets (§4.6, §6.2)', () => {
  let service: QueueEngineService;
  let mockPrisma: any;
  let mockScopeService: any;
  let mockClockService: any;

  beforeEach(() => {
    mockScopeService = {
      validateQueueScope: jest.fn().mockResolvedValue(undefined),
    };
    mockClockService = {
      now: jest.fn().mockReturnValue(new Date('2026-09-20T10:00:00Z')),
      diffInMinutes: jest.fn().mockReturnValue(34),
    };
    mockPrisma = {
      queue: {
        findUnique: jest.fn().mockResolvedValue({
          queueId: 45,
          threadCount: 3,
          isActive: true,
        }),
      },
      queueSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new QueueEngineService(mockPrisma, mockScopeService, mockClockService);
  });

  it('lève 409 THREAD_OCCUPIED quand le guichet est déjà occupé sans takeOver', async () => {
    // Session existante sur le guichet 2
    mockPrisma.queueSession.findFirst
      .mockResolvedValueOnce(null) // pas de session active pour cet utilisateur
      .mockResolvedValueOnce({
        sessionId: 1042,
        threadNumber: 2,
        user: { userId: 7, username: 'amel.b' },
        lastSeenAt: new Date('2026-09-20T09:26:00Z'),
      });

    const caller: any = { userId: 12, roles: ['hotesse'], permissions: ['session_operate'], userType: 'human' };

    try {
      await service.openSession(caller, 45, {
        threadNumber: 2,
        mode: 'active',
        takeOver: false,
      });
      fail('Aurait dû lever AppException');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppException);
      expect(e.code).toBe(ErrorCode.THREAD_OCCUPIED);
      expect(e.translationParams.username).toBe('amel.b');
      expect(e.translationParams.inactiveMinutes).toBe(34);
    }
  });

  it('permet la reprise (takeOver: true) en fermant l\'ancienne session et ouvrant la nouvelle', async () => {
    // Session occupée par un autre utilisateur
    mockPrisma.queueSession.findFirst
      .mockResolvedValueOnce(null) // pas de session active pour l'appelant
      .mockResolvedValueOnce({
        sessionId: 1042,
        threadNumber: 2,
        user: { userId: 7, username: 'amel.b' },
        lastSeenAt: new Date('2026-09-20T09:26:00Z'),
      });

    mockPrisma.customer = {
      findFirst: jest.fn().mockResolvedValue(null),
    };

    mockPrisma.queueSession.create.mockResolvedValue({
      sessionId: 1050,
      queueId: 45,
      userId: 12,
      threadNumber: 2,
      mode: 'active',
      connectedAt: new Date('2026-09-20T10:00:00Z'),
    });

    const caller: any = { userId: 12, roles: ['hotesse'], permissions: ['session_operate'], userType: 'human' };

    const result = await service.openSession(caller, 45, {
      threadNumber: 2,
      mode: 'active',
      takeOver: true,
    });

    expect(result.code).toBe('OK');
    expect((result.data as any).sessionId).toBe(1050);
    expect((result.data as any).takenOverFromSessionId).toBe(1042);
    expect(mockPrisma.queueSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 1042 },
        data: expect.objectContaining({ closureReason: 'taken_over' }),
      }),
    );
  });
});
