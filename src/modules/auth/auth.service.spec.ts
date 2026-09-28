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

  it('should revoke only the specific session when refreshToken is provided', async () => {
    const user: AuthenticatedUser = {
      userId: 5,
      username: 'agent1',
      roles: ['hotesse'],
      permissions: [],
      userType: 'human',
      sessionId: 'session-uuid-1',
    };

    const result = await service.logout(user, 'sample-refresh-token');
    expect(result).toEqual({ success: true });

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE refresh_token_hash = $2 AND revoked_at IS NULL'),
      expect.arrayContaining([expect.any(Date), expect.any(String)]),
    );
  });

  it('should revoke only the caller session when no refreshToken is provided but sessionId exists (SEC-03)', async () => {
    const user: AuthenticatedUser = {
      userId: 5,
      username: 'agent1',
      roles: ['hotesse'],
      permissions: [],
      userType: 'human',
      sessionId: 'session-uuid-device-1',
    };

    const result = await service.logout(user, undefined);
    expect(result).toEqual({ success: true });

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE session_id = $2 AND revoked_at IS NULL'),
      [expect.any(Date), 'session-uuid-device-1'],
    );

    // Verify it did NOT revoke all sessions with WHERE user_id = $2
    expect(dataSourceMock.query).not.toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $2 AND revoked_at IS NULL'),
      expect.anything(),
    );
  });

  it('should fall back to revoking by userId only when neither refreshToken nor sessionId are provided', async () => {
    const result = await service.logout(5, undefined);
    expect(result).toEqual({ success: true });

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $2 AND revoked_at IS NULL'),
      [expect.any(Date), 5],
    );
  });
});
