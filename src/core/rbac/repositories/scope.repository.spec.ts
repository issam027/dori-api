import { DataSource } from 'typeorm';
import { ScopeRepository } from './scope.repository';

describe('ScopeRepository target membership', () => {
  it('checks both direct site assignments and queue assignments without granting global visibility', async () => {
    const query = jest.fn().mockResolvedValue([{ allowed: true }]);
    const repository = new ScopeRepository({ query } as unknown as DataSource);
    await expect(
      repository.userBelongsToSites('target', ['site-a']),
    ).resolves.toBe(true);
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('dorify.dori_user_site_assignment');
    expect(sql).toContain('dorify.dori_user_queue_assignment');
    expect(sql).toContain('q.site_id = ANY($2::uuid[])');
    expect(sql).toContain('u.deleted_at IS NULL');
    expect(values).toEqual(['target', ['site-a']]);
  });

  it('rejects an unassigned manager without querying the target', async () => {
    const query = jest.fn();
    const repository = new ScopeRepository({ query } as unknown as DataSource);
    await expect(repository.userBelongsToSites('target', [])).resolves.toBe(
      false,
    );
    expect(query).not.toHaveBeenCalled();
  });
});
