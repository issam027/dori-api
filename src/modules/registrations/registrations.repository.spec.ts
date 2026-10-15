import { DataSource, EntityManager } from 'typeorm';
import {
  RegistrationsRepository,
  RegistrationsTransaction,
} from './registrations.repository';
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';
import { ConfigService } from '@nestjs/config';

describe('RegistrationsTransaction welcome notifications', () => {
  it.each([
    [false, 'sms.welcome', 'Bienvenue. Ticket A-001.', false],
    [
      true,
      'sms.welcome_with_tracking',
      'Bienvenue. Ticket A-001. http://localhost:5173/track?token=token-1',
      true,
    ],
  ])(
    'renders the configured template when includeTrackingLink=%s',
    async (includeTrackingLink, expectedKey, expectedContent, hasUrl) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([
          {
            rule_id: 8,
            channel: 'sms',
            include_tracking_link: includeTrackingLink,
            locale: 'fr',
            first_name: 'Nadia',
            phone_number: '+21698000000',
            email: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            translation_key: expectedKey,
            locale: 'fr',
            content: hasUrl
              ? 'Bienvenue. Ticket {ticket}. {trackingUrl}'
              : 'Bienvenue. Ticket {ticket}.',
          },
        ])
        .mockResolvedValueOnce([{ notification_id: 20 }]);
      const tx = new RegistrationsTransaction({
        query,
      } as unknown as EntityManager);
      const templateService = new NotificationTemplateService({
        getOrThrow: jest.fn().mockReturnValue('http://localhost:5173'),
      } as unknown as ConfigService);

      const count = await tx.createWelcomeNotifications({
        registrationId: 10,
        trackingToken: 'token-1',
        ticketNumber: 'A-001',
        now: new Date('2026-10-15T10:00:00Z'),
        templateService,
      });

      expect(count).toBe(1);
      expect(query.mock.calls[1][1]).toEqual([[expectedKey], ['fr']]);
      const inserted = JSON.parse(query.mock.calls[2][1][0]);
      expect(inserted[0].content).toBe(expectedContent);
    },
  );

  it('does not enqueue a channel when the person has no recipient', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          rule_id: 9,
          channel: 'email',
          include_tracking_link: true,
          locale: 'fr',
          first_name: 'Nadia',
          phone_number: null,
          email: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ notification_id: 21 }]);
    const tx = new RegistrationsTransaction({
      query,
    } as unknown as EntityManager);
    const templateService = new NotificationTemplateService({
      getOrThrow: jest.fn().mockReturnValue('http://localhost:5173'),
    } as unknown as ConfigService);

    await expect(
      tx.createWelcomeNotifications({
        registrationId: 10,
        trackingToken: 'token-1',
        ticketNumber: 'A-001',
        now: new Date('2026-10-15T10:00:00Z'),
        templateService,
      }),
    ).resolves.toBe(1);
    expect(query).toHaveBeenCalledTimes(3);
    const inserted = JSON.parse(query.mock.calls[2][1][0]);
    expect(inserted[0]).toMatchObject({
      status: 'failed',
      failure_reason: 'RECIPIENT_MISSING:email',
    });
  });
});

describe('RegistrationsRepository public position', () => {
  it('loads the session that called the registration', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const repository = new RegistrationsRepository({
      query,
    } as unknown as DataSource);

    await repository.findByTrackingToken(
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(query.mock.calls[0][0]).toContain('LEFT JOIN dori_operator_session');
    expect(query.mock.calls[0][0]).toContain('os.counter_name');
  });
});
