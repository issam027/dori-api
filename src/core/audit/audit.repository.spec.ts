import { DataSource } from 'typeorm';
import { AuditRepository } from './audit.repository';
import { AuditEventQueryDto } from './dto/audit-query.dto';

describe('AuditRepository', () => {
  it('only appends parameterized records', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new AuditRepository({ query } as unknown as DataSource);
    const record = {
      actorUserId: '00000000-0000-4000-8000-000000000001',
      action: 'queue.reset',
      targetType: 'queue',
      targetId: '4',
      secondaryTargetId: null,
      outcome: 'success' as const,
      correlationId: 'corr-2',
      requestMethod: 'POST',
      requestPath: 'queues/:queueId/reset',
      failureType: null,
      siteScopeId: null,
    };

    await repository.append(record);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain(
      'INSERT INTO dorify.dori_audit_event',
    );
    expect(query.mock.calls[0][1]).toEqual([
      '00000000-0000-4000-8000-000000000001',
      'queue.reset',
      'queue',
      '4',
      null,
      'success',
      'corr-2',
      'POST',
      'queues/:queueId/reset',
      null,
      null,
    ]);
  });

  it('searches with parameterized filters, escaped text and pagination', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ event_id: 'event-1' }]);
    const repository = new AuditRepository({ query } as unknown as DataSource);
    const filter = Object.assign(new AuditEventQueryDto(), {
      actorUserId: '00000000-0000-4000-8000-000000000007',
      outcome: 'success' as const,
      search: 'site%_admin',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });

    const result = await repository.search({
      filter,
      sortField: 'occurred_at',
      sortOrder: 'DESC',
      pageSize: 25,
      offset: 0,
    });

    expect(result).toEqual({ items: [{ event_id: 'event-1' }], total: 1 });
    expect(query.mock.calls[0][0]).toContain('actor_user_id = $1');
    expect(query.mock.calls[1][0]).toContain('ORDER BY occurred_at DESC');
    expect(query.mock.calls[1][1]).toEqual([
      '00000000-0000-4000-8000-000000000007',
      'success',
      '2026-10-01',
      '2026-10-31',
      '%site\\%\\_admin%',
      25,
      0,
    ]);
  });

  it('reads one event by parameterized UUID', async () => {
    const query = jest.fn().mockResolvedValue([{ event_id: 'uuid-1' }]);
    const repository = new AuditRepository({ query } as unknown as DataSource);

    await expect(repository.findById('uuid-1')).resolves.toEqual({
      event_id: 'uuid-1',
    });
    expect(query.mock.calls[0][0]).toContain('WHERE event_id = $1');
    expect(query.mock.calls[0][1]).toEqual(['uuid-1']);
  });
});
