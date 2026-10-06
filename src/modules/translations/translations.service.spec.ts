import { DoriException } from '../../core/errors/dori.exception';
import { TranslationsService } from './translations.service';
import { TranslationsRepository } from './translations.repository';
import { ClockService } from '../../core/clock/clock.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('TranslationsService', () => {
  let service: TranslationsService;
  let repositoryMock: Partial<jest.Mocked<TranslationsRepository>>;
  let clockMock: Partial<jest.Mocked<ClockService>>;
  let realtimeMock: Partial<jest.Mocked<RealtimeService>>;

  const mockUser: AuthenticatedUser = {
    userId: 1,
    username: 'admin',
    roles: ['admin'],
    permissions: ['system_manage'],
    userType: 'human',
  };

  const fixedDate = new Date('2026-10-06T12:00:00Z');

  beforeEach(() => {
    repositoryMock = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      getBundle: jest.fn(),
      findActive: jest.fn(),
    };
    clockMock = {
      now: jest.fn().mockReturnValue(fixedDate),
    };
    realtimeMock = {
      emitTranslationInvalidation: jest.fn(),
    };

    service = new TranslationsService(
      repositoryMock as unknown as TranslationsRepository,
      clockMock as unknown as ClockService,
      realtimeMock as unknown as RealtimeService,
    );
  });

  it('validates template params in service and throws TRANSLATION_PARAM_MISMATCH if mismatched', async () => {
    repositoryMock.findById = jest.fn().mockResolvedValue({
      translation_id: 1,
      translation_key: 'welcome_msg',
      category: 'ihm',
      locale: 'fr',
      content: 'Bienvenue {username}',
      expected_params: ['username'],
      is_active: true,
      created_at: fixedDate,
      updated_at: fixedDate,
    });

    await expect(
      service.updateTranslation(
        1,
        {
          content: 'Bienvenue {name}',
          expectedParams: ['username'],
        },
        mockUser,
      ),
    ).rejects.toThrow(DoriException);

    expect(repositoryMock.update).not.toHaveBeenCalled();
  });

  it('updates translation when params match and emits cache invalidation', async () => {
    repositoryMock.findById = jest.fn().mockResolvedValue({
      translation_id: 1,
      translation_key: 'welcome_msg',
      category: 'ihm',
      locale: 'fr',
      content: 'Bienvenue {username}',
      expected_params: ['username'],
      is_active: true,
      created_at: fixedDate,
      updated_at: fixedDate,
    });

    repositoryMock.update = jest.fn().mockResolvedValue({
      item: {
        translation_id: 1,
        translation_key: 'welcome_msg',
        category: 'ihm',
        locale: 'fr',
        content: 'Bonjour {username}',
        expected_params: ['username'],
        is_active: true,
        created_at: fixedDate,
        updated_at: fixedDate,
      },
      category: 'ihm',
      version: 2,
    });

    const result = await service.updateTranslation(
      1,
      {
        content: 'Bonjour {username}',
      },
      mockUser,
    );

    expect(result.content).toBe('Bonjour {username}');
    expect(repositoryMock.update).toHaveBeenCalledWith(
      1,
      { content: 'Bonjour {username}' },
      mockUser.userId,
      fixedDate,
    );
    expect(realtimeMock.emitTranslationInvalidation).toHaveBeenCalledWith(
      'ihm',
      2,
    );
  });

  it('throws TRANSLATION_NOT_FOUND when translation does not exist', async () => {
    repositoryMock.findById = jest.fn().mockResolvedValue(null);

    await expect(
      service.updateTranslation(999, { content: 'test' }, mockUser),
    ).rejects.toThrow(DoriException);

    expect(repositoryMock.update).not.toHaveBeenCalled();
  });
});
