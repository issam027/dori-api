import { DataSource } from 'typeorm';
import { SitesRepository } from './sites.repository';

describe('SitesRepository', () => {
  it('casts every time parameter explicitly when creating a site', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ site_id: 1 }]),
    } as unknown as DataSource;
    const repository = new SitesRepository(dataSource);

    await repository.create(
      {
        siteName: 'Site test',
        defaultWorkingHoursStart: '08:00',
        defaultWorkingHoursEnd: '17:00',
        defaultBreakStart: '12:00',
        defaultBreakEnd: '14:00',
        defaultDailyResetTime: '03:00',
      },
      1,
      new Date('2026-10-06T12:00:00Z'),
    );

    const sql = (dataSource.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain("COALESCE($10::time, TIME '08:00')");
    expect(sql).toContain("COALESCE($11::time, TIME '17:00')");
    expect(sql).toContain("COALESCE($12::time, TIME '12:00')");
    expect(sql).toContain("COALESCE($13::time, TIME '14:00')");
    expect(sql).toContain("COALESCE($21::time, TIME '03:00')");
  });

  it('deactivates the site and all active child queues in one transaction', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn(async (work) => work({ query })),
    } as unknown as DataSource;
    const repository = new SitesRepository(dataSource);
    const now = new Date('2026-10-15T08:00:00Z');

    await repository.deactivate(7, 3, now);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('UPDATE dori_site SET');
    expect(query.mock.calls[1][0]).toContain(
      'UPDATE dori_queue SET is_active = FALSE',
    );
    expect(query.mock.calls[1][0]).toContain('WHERE site_id = $3');
    expect(query.mock.calls[1][1]).toEqual([now, 3, 7]);
  });

  it('also cascades when a site is disabled through PATCH', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ site_id: 7, is_active: false }])
      .mockResolvedValueOnce([]);
    const dataSource = {
      transaction: jest.fn(async (work) => work({ query })),
    } as unknown as DataSource;
    const repository = new SitesRepository(dataSource);

    await repository.update(
      7,
      { isActive: false },
      3,
      new Date('2026-10-15T08:00:00Z'),
    );

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain(
      'UPDATE dori_queue SET is_active = FALSE',
    );
  });

  it('does not reactivate child queues when the site is reactivated', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ site_id: 7, is_active: true }]);
    const transaction = jest.fn();
    const dataSource = { query, transaction } as unknown as DataSource;
    const repository = new SitesRepository(dataSource);

    await repository.update(
      7,
      { isActive: true },
      3,
      new Date('2026-10-15T08:00:00Z'),
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain('dori_queue');
  });
});
