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
});
