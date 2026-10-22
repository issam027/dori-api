import { DataSource } from 'typeorm';
import { ReportsRepository } from './reports.repository';

describe('ReportsRepository monitoring series', () => {
  it.each(['hour', 'day', 'week', 'month'] as const)(
    'aggregates all breakdowns without N+1 for the %s bucket',
    async (bucket) => {
      const query = jest.fn().mockResolvedValue([]);
      const repository = new ReportsRepository({
        query,
      } as unknown as DataSource);

      await repository.getMonitoringSeries({
        queueIds: [1, 2],
        userIds: [7],
        tierIds: [3],
        statuses: ['served'],
        entryTypes: ['walkin'],
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-02T00:00:00Z',
        bucket,
        timezone: 'Europe/Paris',
      });

      expect(query).toHaveBeenCalledTimes(7);
      expect(query.mock.calls[1][0]).toContain(`date_trunc('${bucket}'`);
      expect(query.mock.calls[0][0]).toContain('r.served_by_user_id = ANY($4)');
      expect(query.mock.calls[0][0]).toContain('r.tier_id = ANY($5)');
      expect(query.mock.calls[0][0]).toContain('r.status = ANY($6)');
      expect(query.mock.calls[0][0]).toContain('r.entry_type = ANY($7)');
      expect(query.mock.calls[0][1]).toHaveLength(7);
      expect(query.mock.calls[1][1]).toHaveLength(8);
      expect(query.mock.calls[2][1]).toHaveLength(7);
      expect(query.mock.calls[3][1]).toHaveLength(7);
      expect(query.mock.calls[4][1]).toHaveLength(7);
      expect(query.mock.calls[5][1]).toHaveLength(7);
      expect(query.mock.calls[6][1]).toHaveLength(7);
      expect(query.mock.calls[1][1][7]).toBe('Europe/Paris');
    },
  );
});
