export const QUEUE_EVENTS_CHANNEL = 'dori:queue-events';

export type QueueDisplayChangeReason =
  | 'registration_created'
  | 'registration_called'
  | 'registration_served'
  | 'registration_no_show';

export type QueueRealtimeEvent =
  | {
      room: `queue:${string}:display`;
      event: 'queue_display_changed';
      payload: {
        queueId: string;
        reason: QueueDisplayChangeReason;
        timestamp: string;
      };
    }
  | {
      room: `queue:${string}:tracking`;
      event: 'queue_position_changed';
      payload: {
        queueId: string;
        timestamp: string;
      };
    };

export function parseQueueRealtimeEvent(
  raw: string,
): QueueRealtimeEvent | null {
  try {
    const value = JSON.parse(raw) as Partial<QueueRealtimeEvent>;
    if (
      typeof value.room !== 'string' ||
      typeof value.event !== 'string' ||
      !value.payload ||
      typeof value.payload.queueId !== 'string'
    ) {
      return null;
    }
    if (
      value.event === 'queue_display_changed' &&
      value.room === `queue:${value.payload.queueId}:display`
    ) {
      return value as QueueRealtimeEvent;
    }
    if (
      value.event === 'queue_position_changed' &&
      value.room === `queue:${value.payload.queueId}:tracking`
    ) {
      return value as QueueRealtimeEvent;
    }
    return null;
  } catch {
    return null;
  }
}
