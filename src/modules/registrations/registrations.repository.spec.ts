import { EntityManager } from 'typeorm';
import { RegistrationsTransaction } from './registrations.repository';

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
            content: hasUrl
              ? 'Bienvenue. Ticket {ticket}. {trackingUrl}'
              : 'Bienvenue. Ticket {ticket}.',
          },
        ])
        .mockResolvedValueOnce([{ notification_id: 20 }]);
      const tx = new RegistrationsTransaction({
        query,
      } as unknown as EntityManager);

      const count = await tx.createWelcomeNotifications({
        registrationId: 10,
        trackingUrl: 'http://localhost:5173/track?token=token-1',
        ticketNumber: 'A-001',
        now: new Date('2026-10-15T10:00:00Z'),
      });

      expect(count).toBe(1);
      expect(query.mock.calls[1][1]).toEqual([expectedKey, 'fr']);
      expect(query.mock.calls[2][1][5]).toBe(expectedContent);
    },
  );

  it('does not enqueue a channel when the person has no recipient', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        rule_id: 9,
        channel: 'email',
        include_tracking_link: true,
        locale: 'fr',
        first_name: 'Nadia',
        phone_number: null,
        email: null,
      },
    ]);
    const tx = new RegistrationsTransaction({
      query,
    } as unknown as EntityManager);

    await expect(
      tx.createWelcomeNotifications({
        registrationId: 10,
        trackingUrl: 'http://localhost:5173/track?token=token-1',
        ticketNumber: 'A-001',
        now: new Date('2026-10-15T10:00:00Z'),
      }),
    ).resolves.toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
