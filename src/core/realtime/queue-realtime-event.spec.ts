import { parseQueueRealtimeEvent } from './queue-realtime-event';

describe('parseQueueRealtimeEvent', () => {
  it('accepts the two supported queue events', () => {
    const queueId = '00000000-0000-4000-8000-000000000001';

    expect(
      parseQueueRealtimeEvent(
        JSON.stringify({
          room: `queue:${queueId}:display`,
          event: 'queue_display_changed',
          payload: { queueId, reason: 'registration_called', timestamp: 'now' },
        }),
      ),
    ).not.toBeNull();
    expect(
      parseQueueRealtimeEvent(
        JSON.stringify({
          room: `queue:${queueId}:tracking`,
          event: 'queue_position_changed',
          payload: { queueId, timestamp: 'now' },
        }),
      ),
    ).not.toBeNull();
  });

  it('rejects unknown events and mismatched rooms', () => {
    const queueId = '00000000-0000-4000-8000-000000000001';

    expect(
      parseQueueRealtimeEvent(
        JSON.stringify({
          room: `queue:${queueId}:display`,
          event: 'registration_called',
          payload: { queueId },
        }),
      ),
    ).toBeNull();
    expect(
      parseQueueRealtimeEvent(
        JSON.stringify({
          room: `queue:${queueId}:tracking`,
          event: 'queue_display_changed',
          payload: { queueId },
        }),
      ),
    ).toBeNull();
  });
});
