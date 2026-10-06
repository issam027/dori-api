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
          sql.includes('FROM dori_user WHERE user_id = $1') &&
          params?.[0] === 5
        ) {
          return [{ user_id: 5, user_type: 'human' }];
        }
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === 5
        ) {
          return [{ max_rank: 4 }];
        }
        return [];
      },
    );

    const result = await repository.getUserMaxRank(5);
    expect(result).toEqual({ exists: true, maxRank: 4, userType: 'human' });
  });

  it('getUserMaxRank returns exists: false when user not found', async () => {
    dataSourceMock.query.mockResolvedValue([]);
    const result = await repository.getUserMaxRank(999);
    expect(result).toEqual({ exists: false, maxRank: 0 });
  });

  it('getRoleRank returns numeric rank when role exists', async () => {
    dataSourceMock.query.mockResolvedValue([{ rank: 3 }]);
    const rank = await repository.getRoleRank(2);
    expect(rank).toBe(3);
  });

  it('getRoleRank returns null when role does not exist', async () => {
    dataSourceMock.query.mockResolvedValue([]);
    const rank = await repository.getRoleRank(99);
    expect(rank).toBeNull();
  });
});
