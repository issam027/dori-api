import { DataSource } from 'typeorm';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let dataSourceMock: { query: jest.Mock; transaction: jest.Mock };

  beforeEach(() => {
    dataSourceMock = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => cb({ query: dataSourceMock.query })),
    };
    repository = new UsersRepository(dataSourceMock as unknown as DataSource);
  });

  it('getUserMaxRank returns exists and rank for valid user', async () => {
    dataSourceMock.query.mockImplementation(
      async (sql: string, params?: any[]) => {
        if (
          sql.includes('FROM dorify.dori_user WHERE user_id = $1') &&
          params?.[0] === '00000000-0000-4000-8000-000000000005'
        ) {
          return [
            {
              user_id: '00000000-0000-4000-8000-000000000005',
              user_type: 'human',
            },
          ];
        }
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000005'
        ) {
          return [{ max_rank: 4 }];
        }
        return [];
      },
    );

    const result = await repository.getUserMaxRank(
      '00000000-0000-4000-8000-000000000005',
    );
    expect(result).toEqual({ exists: true, maxRank: 4, userType: 'human' });
  });

  it('getUserMaxRank returns exists: false when user not found', async () => {
    dataSourceMock.query.mockResolvedValue([]);
    const result = await repository.getUserMaxRank(
      '00000000-0000-4000-8000-000000000999',
    );
    expect(result).toEqual({ exists: false, maxRank: 0 });
  });

  it('getRoleRank returns numeric rank when role exists', async () => {
    dataSourceMock.query.mockResolvedValue([{ rank: 3 }]);
    const rank = await repository.getRoleRank(
      '00000000-0000-4000-8000-000000000002',
    );
    expect(rank).toBe(3);
  });

  it('getRoleRank returns null when role does not exist', async () => {
    dataSourceMock.query.mockResolvedValue([]);
    const rank = await repository.getRoleRank(
      '00000000-0000-4000-8000-000000000099',
    );
    expect(rank).toBeNull();
  });

  it('findUsers filters users assigned directly or through a queue to a site', async () => {
    dataSourceMock.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { user_id: '00000000-0000-4000-8000-000000000005' },
      ]);
    const filter = {
      isActive: true,
      getParams: () => ({ pageSize: 20, offset: 0, sortOrder: 'ASC' }),
      getSafeSortField: () => 'u.created_at',
      createResponse: (items: unknown[], total: number) => ({ items, total }),
    };

    const result = await repository.findUsers(
      filter as any,
      { isGlobal: true, siteIds: [] },
      [
        '00000000-0000-4000-8000-000000000007',
        '00000000-0000-4000-8000-000000000008',
      ],
    );

    expect(dataSourceMock.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        '(us.site_id = ANY($2) OR sqt.site_id = ANY($2))',
      ),
      [
        true,
        [
          '00000000-0000-4000-8000-000000000007',
          '00000000-0000-4000-8000-000000000008',
        ],
      ],
    );
    expect(dataSourceMock.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        '(us.site_id = ANY($2) OR sqt.site_id = ANY($2))',
      ),
      [
        true,
        [
          '00000000-0000-4000-8000-000000000007',
          '00000000-0000-4000-8000-000000000008',
        ],
      ],
    );
    expect(result).toEqual({
      items: [{ user_id: '00000000-0000-4000-8000-000000000005' }],
      total: 1,
    });
  });
});
