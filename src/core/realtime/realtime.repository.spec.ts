import { DataSource } from 'typeorm';
import { RealtimeRepository } from './realtime.repository';

describe('RealtimeRepository', () => {
  it('reads the current transactional topic state', async () => {
    const state = {
      version: '4',
      event_id: '00000000-0000-4000-8000-000000000001',
      queue_id: '00000000-0000-4000-8000-000000000002',
      event_type: 'queue_display_changed',
      payload: { queueId: '00000000-0000-4000-8000-000000000002' },
    };
    const query = jest.fn().mockResolvedValue([state]);
    const repository = new RealtimeRepository({
      query,
    } as unknown as DataSource);

    await expect(
      repository.findTopicState(state.queue_id, 'queue_display_changed'),
    ).resolves.toEqual(state);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('dorify.dori_realtime_topic_state'),
      [state.queue_id, state.event_type],
    );
  });
});
