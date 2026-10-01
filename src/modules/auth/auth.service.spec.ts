import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

jest.mock('uuid', () => ({ v4: () => 'mocked-uuid' }));

import { AuthService } from './auth.service';
import { ClockService } from '../../core/clock/clock.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('AuthService — SEC-03 Logout Specific Session', () => {
  let service: AuthService;
  let dataSourceMock: { query: jest.Mock };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'security.bcryptRounds') return 12;
              return null;
            }),
          },
        },
        {
          provide: ClockService,
          useValue: {
            now: jest.fn(() => new Date('2026-09-28T12:00:00Z')),
          },
        },
        {
          provide: ScopeService,
          useValue: {
            getUserScope: jest.fn(),
            invalidateUserScope: jest.fn(),
            clearAllScopeCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('CAS 1 — should revoke only the caller current session when no userId provided', async () => {
    const caller: AuthenticatedUser = {
      userId: 5,
      username: 'agent1',
      roles: ['hotesse'],
      permissions: [],
      userType: 'human',
      sessionId: 'session-uuid-device-1',
    };

    const result = await service.logout(caller, {});
    expect(result).toEqual({ success: true });

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE session_id = $2 AND revoked_at IS NULL'),
      [expect.any(Date), 'session-uuid-device-1'],
    );
    // Must NOT revoke all sessions
    expect(dataSourceMock.query).not.toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $2 AND revoked_at IS NULL'),
      expect.anything(),
    );
  });

  it('CAS 2 — should revoke all caller sessions (global_logout) when userId == caller.userId', async () => {
    const caller: AuthenticatedUser = {
      userId: 5,
      username: 'agent1',
      roles: ['hotesse'],
      permissions: [],
      userType: 'human',
      sessionId: 'session-uuid-device-1',
    };

    const result = await service.logout(caller, { userId: 5 });
    expect(result).toEqual({ success: true });

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining("revoked_reason = 'global_logout'"),
      [expect.any(Date), 5],
    );
  });

  it('CAS 3 — should throw FORBIDDEN_PERMISSION when a hotesse tries to force-disconnect another user', async () => {
    const caller: AuthenticatedUser = {
      userId: 5,
      username: 'agent1',
      roles: ['hotesse'],
      permissions: [],
      userType: 'human',
      sessionId: 'session-uuid-1',
    };

    await expect(service.logout(caller, { userId: 99 })).rejects.toMatchObject({
      code: 'FORBIDDEN_PERMISSION',
    });
  });

  it('CAS 3 — should force-disconnect a lower-ranked user when caller is a manager', async () => {
    const caller: AuthenticatedUser = {
      userId: 10,
      username: 'manager1',
      roles: ['manager'],
      permissions: [],
      userType: 'human',
      sessionId: 'session-mgr',
    };

    // caller rank = 3, target rank = 2 (hotesse)
    dataSourceMock.query
      .mockResolvedValueOnce([{ max_rank: 3 }])  // callerRankRes
      .mockResolvedValueOnce([{ max_rank: 2 }])  // targetRankRes
      .mockResolvedValueOnce([{ user_id: 20 }]); // targetUsers exists

    const result = await service.logout(caller, { userId: 20 });
    expect(result).toEqual({ success: true });

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining("revoked_reason = 'force_logout'"),
      [expect.any(Date), 20],
    );
  });
});
