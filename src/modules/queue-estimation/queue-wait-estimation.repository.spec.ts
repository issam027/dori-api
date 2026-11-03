import { DataSource } from 'typeorm';
import { QueueWaitEstimationRepository } from './queue-wait-estimation.repository';

describe('ticket estimation burst batching', () => {
  const now = new Date('2026-11-03T09:00:00.000Z');
  it('ranks once for concurrent readers and returns only the requested tickets', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ registration_id: 'a' }, { registration_id: 'b' }]);
    const repository = new QueueWaitEstimationRepository({
      query,
    } as unknown as DataSource);
    const [a, b] = await Promise.all([
      repository.findTicketEstimates(['a'], now),
      repository.findTicketEstimates(['b'], now),
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1][0]).toEqual(['a', 'b']);
    expect(a).toEqual([{ registration_id: 'a' }]);
    expect(b).toEqual([{ registration_id: 'b' }]);
    await repository.findTicketEstimates(['a'], now);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('propagates failures to every reader and permits a fresh retry', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue([]);
    const repository = new QueueWaitEstimationRepository({
      query,
    } as unknown as DataSource);
    const results = await Promise.allSettled([
      repository.findTicketEstimates(['a'], now),
      repository.findTicketEstimates(['b'], now),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    await expect(repository.findTicketEstimates(['a'], now)).resolves.toEqual(
      [],
    );
  });

  it('does not combine snapshots on different observation boundaries', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new QueueWaitEstimationRepository({
      query,
    } as unknown as DataSource);
    await Promise.all([
      repository.findTicketEstimates(['a'], now),
      repository.findTicketEstimates(['b'], new Date(now.getTime() + 1000)),
    ]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
