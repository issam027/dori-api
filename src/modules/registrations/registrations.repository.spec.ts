import { DataSource, EntityManager } from 'typeorm';
import {
  RegistrationsRepository,
  RegistrationsTransaction,
} from './registrations.repository';
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';
import { ConfigService } from '@nestjs/config';

describe('RegistrationsTransaction reschedule result', () => {
  it('normalizes the installed TypeORM UPDATE result and updates tracking in the same statement', async () => {
    const row = { registration_id: 'registration', ticket_number: 'A002' };
    const query = jest.fn().mockResolvedValue([[row], 1]);
    const tx = new RegistrationsTransaction({
      query,
    } as unknown as EntityManager);
    const now = new Date('2026-10-30T12:00:00Z');
    const scheduledTime = new Date('2026-11-02T09:00:00Z');
    const expiry = new Date('2026-11-02T22:59:59.999Z');
    await expect(
      tx.reschedule(
        'registration',
        scheduledTime,
        '2026-11-02',
        'A002',
        now,
        expiry,
      ),
    ).resolves.toEqual(row);
    expect(query.mock.calls[0][0]).toContain(
      'registration_tracking_token_valid_until=$6',
    );
    expect(query.mock.calls[0][1][5]).toEqual(expiry);
  });
});

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
            rule_id: '00000000-0000-4000-8000-000000000008',
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
        .mockResolvedValueOnce([
          { notification_id: '00000000-0000-4000-8000-000000000020' },
        ]);
      const tx = new RegistrationsTransaction({
        query,
      } as unknown as EntityManager);
      const templateService = new NotificationTemplateService({
        getOrThrow: jest.fn().mockReturnValue('http://localhost:5173'),
      } as unknown as ConfigService);

      const count = await tx.createWelcomeNotifications({
        registrationId: '00000000-0000-4000-8000-000000000010',
        trackingToken: 'token-1',
        ticketNumber: 'A-001',
        now: new Date('2026-10-15T10:00:00Z'),
        templateService,
      });

      expect(count).toBe(1);
      expect(query.mock.calls[1][1]).toEqual([[expectedKey], ['fr']]);
      const inserted = JSON.parse(query.mock.calls[2][1][0]);
      expect(inserted[0].content).toBe(expectedContent);
      expect(query.mock.calls[2][0]).toContain('registration_id uuid');
      expect(query.mock.calls[2][0]).toContain('rule_id uuid');
    },
  );

  it('does not enqueue a channel when the person has no recipient', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          rule_id: '00000000-0000-4000-8000-000000000009',
          channel: 'email',
          include_tracking_link: true,
          locale: 'fr',
          first_name: 'Nadia',
          phone_number: null,
          email: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { notification_id: '00000000-0000-4000-8000-000000000021' },
      ]);
    const tx = new RegistrationsTransaction({
      query,
    } as unknown as EntityManager);
    const templateService = new NotificationTemplateService({
      getOrThrow: jest.fn().mockReturnValue('http://localhost:5173'),
    } as unknown as ConfigService);

    await expect(
      tx.createWelcomeNotifications({
        registrationId: '00000000-0000-4000-8000-000000000010',
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

    expect(query.mock.calls[0][0]).toContain(
      'LEFT JOIN dorify.dori_operator_session',
    );
    expect(query.mock.calls[0][0]).toContain('os.counter_name');
  });
});

describe('RegistrationsRepository appointment lookup', () => {
  it('matches an E.164 phone exactly for the current business day and accessible queues', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const repository = new RegistrationsRepository({
      query,
    } as unknown as DataSource);
    const now = new Date('2026-10-17T23:30:00.000Z');

    await repository.lookup({
      queueIds: [
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004',
      ],
      phoneNumber: '+21698765432',
      now,
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("r.entry_type='appointment'");
    expect(sql).toContain("r.status='booked'");
    expect(sql).toContain("r.appointment_status IN ('booked','rescheduled')");
    expect(sql).toContain('r.queue_id=ANY($1)');
    expect(sql).toContain('p.phone_number=$2');
    expect(sql).toContain('AT TIME ZONE s.timezone');
    expect(params).toEqual([
      [
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004',
      ],
      '+21698765432',
      now,
    ]);
  });

  it('matches the last name and appointment time exactly with the same restrictions', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    const repository = new RegistrationsRepository({
      query,
    } as unknown as DataSource);
    const scheduledTime = new Date('2026-10-18T08:00:00.000Z');

    await repository.lookup({
      queueIds: ['00000000-0000-4000-8000-000000000003'],
      lastName: 'Ben Ali',
      scheduledTime,
      now: new Date('2026-10-17T10:00:00.000Z'),
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('LOWER(p.last_name)=LOWER($2)');
    expect(sql).toContain('r.scheduled_time=$3');
    expect(sql).not.toContain('AT TIME ZONE s.timezone');
    expect(params).toEqual([
      ['00000000-0000-4000-8000-000000000003'],
      'Ben Ali',
      scheduledTime,
    ]);
  });
});

describe('RegistrationsRepository filters', () => {
  it('filters walk-ins by business date and appointments by scheduled time', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const repository = new RegistrationsRepository({
      query,
    } as unknown as DataSource);
    const fromInclusive = new Date('2026-10-01T00:00:00Z');
    const toExclusive = new Date('2026-11-01T00:00:00Z');

    await repository.findPage(
      { isActive: true } as any,
      undefined,
      'registration_id',
      'ASC',
      25,
      0,
      {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        fromInclusive,
        toExclusive,
      },
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("r.entry_type = 'walkin'");
    expect(sql).toContain('r.business_date BETWEEN $2::date AND $3::date');
    expect(sql).toContain("r.entry_type = 'appointment'");
    expect(sql).toContain('r.scheduled_time >= $4');
    expect(sql).toContain('r.scheduled_time < $5');
    expect(params).toEqual([
      true,
      '2026-10-01',
      '2026-10-31',
      fromInclusive,
      toExclusive,
    ]);
  });

  it('returns zero active notes when the registered person has none', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          registration_id: '00000000-0000-4000-8000-000000000010',
          active_note_count: 0,
        },
      ]);
    const repository = new RegistrationsRepository({
      query,
    } as unknown as DataSource);

    const result = await repository.findPage(
      { isActive: true } as any,
      undefined,
      'registration_id',
      'ASC',
      25,
      0,
    );

    expect(query.mock.calls[1][0]).toContain('COUNT(*)::int');
    expect(query.mock.calls[1][0]).toContain('pn.is_active = TRUE');
    expect(query.mock.calls[1][0]).toContain('pn.deleted_at IS NULL');
    expect(result.items[0].active_note_count).toBe(0);
  });

  it('filters registrations by served_by_user_id', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const repository = new RegistrationsRepository({
      query,
    } as unknown as DataSource);

    await repository.findPage(
      {
        isActive: true,
        servedByUserId: '00000000-0000-4000-8000-000000000012',
      } as any,
      undefined,
      'registration_id',
      'ASC',
      25,
      0,
    );

    expect(query.mock.calls[0][0]).toContain('r.served_by_user_id=$2');
    expect(query.mock.calls[0][1]).toEqual([
      true,
      '00000000-0000-4000-8000-000000000012',
    ]);
    expect(query.mock.calls[1][1]).toEqual([
      true,
      '00000000-0000-4000-8000-000000000012',
      25,
      0,
    ]);
  });
});
