import { Test, TestingModule } from '@nestjs/testing';
import { ScopeService, UserScope } from './scope.service';
import { ScopeRepository } from '../repositories/scope.repository';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

describe('ScopeService', () => {
  let service: ScopeService;
  let repository: jest.Mocked<ScopeRepository>;
  let redisMock: {
    status: string;
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    scan: jest.Mock;
  };

  const rootUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    username: 'root',
    roles: ['root'],
    permissions: [],
    userType: 'human',
  };

  const managerUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000002',
    username: 'manager',
    roles: ['manager'],
    permissions: [],
    userType: 'human',
  };

  const operatorUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000003',
    username: 'operator',
    roles: ['operator'],
    permissions: [],
    userType: 'human',
  };

  beforeEach(async () => {
    redisMock = {
      status: 'ready',
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue(['0', []]),
    };

    const repositoryMock = {
      findUserSiteIds: jest.fn().mockResolvedValue(['site-1']),
      findQueueIdsBySites: jest.fn().mockResolvedValue(['queue-1', 'queue-2']),
      findUserQueueScope: jest.fn().mockResolvedValue({
        queueIds: ['queue-1'],
        siteIds: ['site-1'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScopeService,
        { provide: ScopeRepository, useValue: repositoryMock },
        { provide: REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get<ScopeService>(ScopeService);
    repository = module.get(ScopeRepository);
  });

  it('writes root scope to Redis with dori:scope:user: prefix', async () => {
    const scope = await service.getUserScope(rootUser);
    expect(scope).toEqual({ isGlobal: true, siteIds: [], queueIds: [] });
    expect(redisMock.get).toHaveBeenCalledWith(
      `dori:scope:user:${rootUser.userId}`,
    );
    expect(redisMock.setex).toHaveBeenCalledWith(
      `dori:scope:user:${rootUser.userId}`,
      30,
      JSON.stringify(scope),
    );
  });

  it('serves from Redis cache when key exists', async () => {
    const cachedScope: UserScope = {
      isGlobal: false,
      siteIds: ['cached-site'],
      queueIds: ['cached-queue'],
    };
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cachedScope));

    const scope = await service.getUserScope(managerUser);
    expect(scope).toEqual(cachedScope);
    expect(repository.findUserSiteIds).not.toHaveBeenCalled();
    expect(redisMock.setex).not.toHaveBeenCalled();
  });

  it('computes and caches manager scope on cache miss', async () => {
    const scope = await service.getUserScope(managerUser);
    expect(scope).toEqual({
      isGlobal: false,
      siteIds: ['site-1'],
      queueIds: ['queue-1', 'queue-2'],
    });
    expect(repository.findUserSiteIds).toHaveBeenCalledWith(managerUser.userId);
    expect(repository.findQueueIdsBySites).toHaveBeenCalledWith(['site-1']);
    expect(redisMock.setex).toHaveBeenCalledWith(
      `dori:scope:user:${managerUser.userId}`,
      30,
      JSON.stringify(scope),
    );
  });

  it('computes and caches operator scope on cache miss', async () => {
    const scope = await service.getUserScope(operatorUser);
    expect(scope).toEqual({
      isGlobal: false,
      siteIds: ['site-1'],
      queueIds: ['queue-1'],
    });
    expect(repository.findUserQueueScope).toHaveBeenCalledWith(
      operatorUser.userId,
    );
    expect(redisMock.setex).toHaveBeenCalledWith(
      `dori:scope:user:${operatorUser.userId}`,
      30,
      JSON.stringify(scope),
    );
  });

  it('falls back to database when Redis errors on get and setex', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('Connection lost'));
    redisMock.setex.mockRejectedValueOnce(new Error('Connection lost'));

    const scope = await service.getUserScope(operatorUser);
    expect(scope).toEqual({
      isGlobal: false,
      siteIds: ['site-1'],
      queueIds: ['queue-1'],
    });
    expect(repository.findUserQueueScope).toHaveBeenCalledWith(
      operatorUser.userId,
    );
  });

  it('invalidates user scope by deleting Redis key', () => {
    service.invalidateUserScope(managerUser.userId);
    expect(redisMock.del).toHaveBeenCalledWith(
      `dori:scope:user:${managerUser.userId}`,
    );
  });

  it('clears all user scope cache via scan and del', async () => {
    redisMock.scan
      .mockResolvedValueOnce(['10', ['dori:scope:user:1', 'dori:scope:user:2']])
      .mockResolvedValueOnce(['0', ['dori:scope:user:3']]);

    await service.clearAllScopeCache();

    expect(redisMock.del).toHaveBeenCalledWith(
      'dori:scope:user:1',
      'dori:scope:user:2',
    );
    expect(redisMock.del).toHaveBeenCalledWith('dori:scope:user:3');
  });
});
