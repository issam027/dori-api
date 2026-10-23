import { DataSource } from 'typeorm';
import { AuditRepository } from './audit.repository';

describe('AuditRepository', () => {
  it('only appends parameterized records', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new AuditRepository({ query } as unknown as DataSource);
    const record = {
      actorUserId: 1,
      action: 'queue.reset',
      targetType: 'queue',
      targetId: '4',
      secondaryTargetId: null,
      outcome: 'success' as const,
      correlationId: 'corr-2',
      requestMethod: 'POST',
      requestPath: 'queues/:queueId/reset',
      failureType: null,
    };

    await repository.append(record);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('INSERT INTO dori_audit_event');
    expect(query.mock.calls[0][1]).toEqual([
      1,
      'queue.reset',
      'queue',
      '4',
      null,
      'success',
      'corr-2',
      'POST',
      'queues/:queueId/reset',
      null,
    ]);
  });
});
