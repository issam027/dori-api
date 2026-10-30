import { ConfigService } from '@nestjs/config';
import { prepareNotification } from './notification-batch';
import { NotificationTemplateService } from './notification-template.service';

describe('Shared automatic notification preparation', () => {
  const renderer = new NotificationTemplateService({
    getOrThrow: () => 'https://example.test',
  } as unknown as ConfigService);
  const input = {
    registrationId: 'registration',
    ruleId: 'rule',
    channel: 'sms' as const,
    includeTrackingLink: true,
    locale: 'ar',
    phoneNumber: '+2161',
    firstName: 'Nadia',
    ticketNumber: 'A001',
    trackingToken: 'opaque-token',
  };

  it.each(['welcome', 'threshold'] as const)(
    'applies the same locale fallback and rendering for %s',
    (type) => {
      const notification = prepareNotification(
        { ...input, type },
        new Map([
          [
            `sms.${type}_with_tracking:fr`,
            '{firstName}, {ticket} : {trackingUrl}',
          ],
        ]),
        renderer,
      );
      expect(notification).toMatchObject({
        status: 'pending',
        recipient: '+2161',
        content: 'Nadia, A001 : https://example.test/track?token=opaque-token',
      });
    },
  );

  it('records a missing recipient as a failure without enqueueing it for delivery', () => {
    expect(
      prepareNotification(
        { ...input, type: 'welcome', phoneNumber: undefined },
        new Map(),
        renderer,
      ),
    ).toMatchObject({
      status: 'failed',
      failureReason: 'RECIPIENT_MISSING:sms',
    });
  });

  it('does not include a tracking link when the rule disables it', () => {
    expect(
      prepareNotification(
        { ...input, type: 'threshold', includeTrackingLink: false },
        new Map([['sms.threshold:ar', 'Ticket {ticket}']]),
        renderer,
      ),
    ).toMatchObject({ status: 'pending', content: 'Ticket A001' });
  });
});
