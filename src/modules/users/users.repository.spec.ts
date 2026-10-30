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

  it('updates profile and status in the same transaction as session revocation', async () => {
    dataSourceMock.query
      .mockResolvedValueOnce([{ user_id: 'user', is_active: false }])
      .mockResolvedValue([]);
    const now = new Date('2026-10-30T12:00:00Z');
    await repository.updateUser(
      'user',
      { email: 'new@example.com', isActive: false },
      'admin',
      now,
    );
    expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
    const [sql, parameters] = dataSourceMock.query.mock.calls[0];
    expect(sql).toContain('email = $1');
    expect(sql).toContain('is_active = $2');
    expect(parameters).toEqual([
      'new@example.com',
      false,
      now,
      'admin',
      now,
      'user',
    ]);
    expect(dataSourceMock.query.mock.calls[1][0]).toContain(
      "revoked_reason = 'account_disabled'",
    );
    expect(dataSourceMock.query.mock.calls[2][0]).toContain(
      'UPDATE dorify.dori_operator_session',
    );
  });

  it('does not apply a status change separately when the combined profile update fails', async () => {
    dataSourceMock.query.mockRejectedValue(new Error('duplicate email'));
    await expect(
      repository.updateUser(
        'user',
        { email: 'used@example.com', isActive: false },
        'admin',
        new Date('2026-10-30T12:00:00Z'),
      ),
    ).rejects.toThrow('duplicate email');
    expect(dataSourceMock.query).toHaveBeenCalledTimes(1);
    expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
  });

  it('returns the updated profile with the installed TypeORM UPDATE result format', async () => {
    const row = { user_id: 'user', email: 'new@example.com' };
    dataSourceMock.query.mockResolvedValue([[row], 1]);
    await expect(
      repository.updateUser(
        'user',
        { email: row.email },
        'admin',
        new Date('2026-10-30T12:00:00Z'),
      ),
    ).resolves.toEqual(row);
  });

  it('does not report a missing role as removed or revoke sessions for an empty TypeORM DELETE result', async () => {
    dataSourceMock.query.mockResolvedValue([[], 0]);
    await expect(
      repository.removeUserRole(
        'user',
        'unassigned-role',
        new Date('2026-10-30T12:00:00Z'),
      ),
    ).resolves.toBe(false);
    expect(dataSourceMock.query).toHaveBeenCalledTimes(1);
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
