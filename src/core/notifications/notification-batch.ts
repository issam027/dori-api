import { DataSource, EntityManager } from 'typeorm';
import { returningRows } from '../database/returning-rows';
import {
  NotificationChannel,
  NotificationTemplateService,
  NotificationType,
} from './notification-template.service';

export type NotificationRenderer = Pick<
  NotificationTemplateService,
  'templateKey' | 'buildTrackingUrl' | 'render'
>;

export interface PreparedNotification {
  registrationId: string;
  ruleId: string;
  channel: NotificationChannel;
  locale: string;
  recipient: string | null | undefined;
  content: string | null;
  status: 'failed' | 'pending';
  failureReason: string | null;
}

export function prepareNotification(
  input: {
    registrationId: string;
    ruleId: string;
    channel: NotificationChannel;
    type: NotificationType;
    includeTrackingLink: boolean;
    locale: string;
    phoneNumber?: string | null;
    email?: string | null;
    firstName?: string | null;
    ticketNumber: string;
    trackingToken: string;
  },
  templates: Map<string, string>,
  renderer: NotificationRenderer,
): PreparedNotification {
  const key = renderer.templateKey(
    input.channel,
    input.type,
    input.includeTrackingLink,
  );
  const template =
    templates.get(`${key}:${input.locale}`) ?? templates.get(`${key}:fr`);
  const recipient = input.channel === 'sms' ? input.phoneNumber : input.email;
  const rendered =
    template === undefined
      ? { content: null, failureReason: `TEMPLATE_NOT_FOUND:${key}` }
      : renderer.render(template, {
          firstName: input.firstName ?? '',
          ticket: input.ticketNumber,
          trackingUrl: input.includeTrackingLink
            ? renderer.buildTrackingUrl(input.trackingToken)
            : undefined,
        });
  const failureReason =
    (!recipient ? `RECIPIENT_MISSING:${input.channel}` : null) ??
    rendered.failureReason;
  return {
    registrationId: input.registrationId,
    ruleId: input.ruleId,
    channel: input.channel,
    locale: input.locale,
    recipient,
    content: rendered.content,
    status: failureReason ? 'failed' : 'pending',
    failureReason,
  };
}

// The caller supplies its transaction manager when notifications must commit
// atomically with the business mutation (notably registration creation).
export async function insertPreparedNotifications(
  database: DataSource | EntityManager,
  type: NotificationType,
  notifications: PreparedNotification[],
  now: Date,
): Promise<number> {
  if (!notifications.length) return 0;
  const result: unknown = await database.query(
    `INSERT INTO dorify.dori_notification (
       registration_id, rule_id, channel, notification_type, locale, recipient,
       notification_content, notification_status, failure_reason,
       attempt_count, created_at, updated_at
     )
     SELECT x.registration_id, x.rule_id, x.channel, $3, x.locale,
            x.recipient, x.content, x.status, x.failure_reason, 0, $2, $2
     FROM jsonb_to_recordset($1::jsonb) AS x(
       registration_id uuid, rule_id uuid, channel varchar, locale varchar,
       recipient varchar, content text, status varchar, failure_reason text
     )
     ON CONFLICT (registration_id, notification_type, channel) DO NOTHING
     RETURNING notification_id`,
    [
      JSON.stringify(
        notifications.map((notification) => ({
          registration_id: notification.registrationId,
          rule_id: notification.ruleId,
          channel: notification.channel,
          locale: notification.locale,
          recipient: notification.recipient ?? null,
          content: notification.content,
          status: notification.status,
          failure_reason: notification.failureReason,
        })),
      ),
      now,
      type,
    ],
  );
  return returningRows(result).length;
}
