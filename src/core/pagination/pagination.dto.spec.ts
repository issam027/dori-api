import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LimitQueryDto, PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('centralizes defaults and response metadata', () => {
    const pagination = new PaginationDto();

    expect(pagination.getParams()).toMatchObject({
      page: 1,
      pageSize: 25,
      offset: 0,
    });
    expect(pagination.createResponse(['a', 'b'], 51)).toEqual({
      items: ['a', 'b'],
      page: 1,
      pageSize: 25,
      total: 51,
      totalPages: 3,
    });
  });

  it('calculates offset and applies the sort allowlist', () => {
    const pagination = plainToInstance(PaginationDto, {
      page: '3',
      pageSize: '10',
      sort: 'createdAt:asc',
    });

    expect(pagination.getParams()).toMatchObject({
      page: 3,
      pageSize: 10,
      offset: 20,
      sortField: 'created_at',
      sortOrder: 'ASC',
    });
    expect(pagination.getSafeSortField(['created_at'], 'id')).toBe(
      'created_at',
    );
    expect(pagination.getSafeSortField(['id'], 'id')).toBe('id');
  });

  it('rejects invalid page and pageSize values', async () => {
    const pagination = plainToInstance(PaginationDto, {
      page: 0,
      pageSize: 101,
    });

    const errors = await validate(pagination);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'page',
      'pageSize',
    ]);
  });
});

describe('LimitQueryDto', () => {
  it('transforms a valid numeric query parameter', async () => {
    const query = plainToInstance(LimitQueryDto, { limit: '10' });

    expect(await validate(query)).toHaveLength(0);
    expect(query.limit).toBe(10);
  });

  it.each([0, -1, 101, 1.5, 'invalid'])(
    'rejects an invalid limit: %p',
    async (limit) => {
      const query = plainToInstance(LimitQueryDto, { limit });

      const errors = await validate(query);
      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    },
  );
});
