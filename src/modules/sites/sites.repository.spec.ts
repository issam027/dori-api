import { DataSource } from 'typeorm';
import { SitesRepository } from './sites.repository';

describe('SitesRepository direct site users', () => {
  it('lists only active users having an active admin or manager role', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const repository = new SitesRepository({ query } as unknown as DataSource);

    await repository.findDirectSiteUsers(
      1,
      'us.assigned_at',
      'ASC',
      25,
      0,
      'admin',
    );

    expect(query.mock.calls[0][0]).toContain(
      "r.role_name IN ('admin', 'manager')",
    );
    expect(query.mock.calls[0][0]).toContain('r.is_active = TRUE');
    expect(query.mock.calls[0][0]).toContain('r.role_name = $2');
    expect(query.mock.calls[0][1]).toEqual([1, 'admin']);
    expect(query.mock.calls[1][0]).toContain(
      "r.role_name IN ('admin', 'manager')",
    );
  });

  it('accepts only active admin or manager roles for direct assignment', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ user_id: 2 }]);
    const repository = new SitesRepository({ query } as unknown as DataSource);

    await expect(repository.hasActiveDirectSiteRole(2)).resolves.toBe(true);
    expect(query.mock.calls[0][0]).toContain(
      "r.role_name IN ('admin', 'manager')",
    );
    expect(query.mock.calls[0][0]).toContain('r.is_active = TRUE');
  });
});

describe('SitesRepository site status filter', () => {
  it('returns active and inactive sites when isActive is omitted', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ site_id: 1 }, { site_id: 2 }]);
    const repository = new SitesRepository({ query } as unknown as DataSource);

    await repository.findPage(null, undefined, 'created_at', 'DESC', 25, 0);

    expect(query.mock.calls[0][0]).not.toContain('is_active =');
    expect(query.mock.calls[0][1]).toEqual([]);
    expect(query.mock.calls[1][0]).not.toContain('is_active =');
  });

  it.each([true, false])('filters sites when isActive=%s', async (isActive) => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([]);
    const repository = new SitesRepository({ query } as unknown as DataSource);

    await repository.findPage(null, isActive, 'created_at', 'DESC', 25, 0);

    expect(query.mock.calls[0][0]).toContain('WHERE is_active = $1');
    expect(query.mock.calls[0][1]).toEqual([isActive]);
  });
});
