import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { Subject, filter } from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import {
  DatabaseChange,
  DatabaseEventsService,
} from '../../core/database/database-events.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { AnnouncementsRepository } from './announcements.repository';
import { AnnouncementsService } from './announcements.service';
import { LocalAnnouncementsService } from './local-announcements.service';
import {
  AnnouncementItemDto,
  CreateAnnouncementDto,
  AnnouncementQueryDto,
} from './dto/announcement.dto';

const one = '550e8400-e29b-41d4-a716-446655440000',
  two = '550e8400-e29b-41d4-a716-446655440001';
const instant = new Date('2026-11-04T10:00:00Z');
const user = {
  userId: one,
  roles: ['manager'],
  permissions: ['site_edit'],
} as AuthenticatedUser;
const clock = {
  now: () => new Date(instant),
  parse: (value: string) => new Date(value),
} as ClockService;
const notice = (
  id: string,
  starts = instant.getTime() - 1000,
  ends = instant.getTime() + 60000,
): AnnouncementItemDto => ({
  announcementId: id,
  title: 'Maintenance',
  message: 'Service notice',
  severity: 'warning',
  startsAt: new Date(starts).toISOString(),
  endsAt: new Date(ends).toISOString(),
});
const body = () =>
  Object.assign(new CreateAnnouncementDto(), {
    scope: 'sites',
    targetIds: [one],
    title: 'Maintenance',
    message: 'Service notice',
    severity: 'info',
    endsAt: '2026-11-04T12:00:00Z',
  });
describe('announcement administration boundaries', () => {
  function setup(mode = 'cloud') {
    const repository = {
      create: jest.fn(),
      list: jest.fn(),
      find: jest.fn(),
      withdraw: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const scope = {
      getUserScope: jest.fn(async () => ({
        isGlobal: false,
        siteIds: [one],
        queueIds: [],
      })),
    };
    const service = new AnnouncementsService(
      repository as unknown as AnnouncementsRepository,
      clock,
      { get: () => mode } as unknown as ConfigService,
      scope as unknown as ScopeService,
    );
    return { repository, scope, service };
  }
  it.each(['cloud', 'intra'])(
    'allows a manager to publish to their own sites on %s',
    async (mode) => {
      const h = setup(mode);
      await h.service.create(body(), user);
      expect(h.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'sites', targetIds: [one] }),
        one,
        instant,
        new Date('2026-11-04T12:00:00Z'),
        instant,
      );
    },
  );
  it('rejects a mixed target set before inserting any announcement', async () => {
    const h = setup();
    await expect(
      h.service.create({ ...body(), targetIds: [one, two] }, user),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(h.repository.create).not.toHaveBeenCalled();
  });
  it('keeps remote installation management cloud-only even for root', async () => {
    const h = setup('intra');
    await expect(
      h.service.create(
        { ...body(), scope: 'installations' },
        { ...user, roles: ['root'] },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
  });
  it('requires installation management permission for a remote broadcast', async () => {
    const h = setup();
    await expect(
      h.service.create({ ...body(), scope: 'installations' }, user),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
  });
  it('does not let a manager withdraw a notice that also covers an inaccessible site', async () => {
    const h = setup();
    h.repository.find.mockResolvedValue({
      scope: 'sites',
      targets: [{ targetId: one }, { targetId: two }],
    });
    await expect(h.service.withdraw(one, user)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
    expect(h.repository.withdraw).not.toHaveBeenCalled();
  });
  it('rejects an expired or excessively long publication period', async () => {
    const h = setup();
    for (const endsAt of ['2026-11-04T09:00:00Z', '2027-01-01T12:00:00Z'])
      await expect(
        h.service.create({ ...body(), endsAt }, user),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(h.repository.create).not.toHaveBeenCalled();
  });
  it('filters the administration listing to the current fresh site scope', async () => {
    const h = setup();
    const query = {
      scope: 'sites' as const,
      page: 1,
      pageSize: 10,
      sort: 'createdAt:desc' as const,
    };
    await h.service.list(query, user);
    expect(h.scope.getUserScope).toHaveBeenCalledWith(user, { fresh: true });
    expect(h.repository.list).toHaveBeenCalledWith(
      'sites',
      1,
      10,
      instant,
      [one],
      query,
    );
  });
  it('redacts shared announcement details and forbids editing or deleting outside the complete scope', async () => {
    const h = setup();
    h.repository.find.mockResolvedValue({
      ...notice(one),
      scope: 'sites',
      status: 'active',
      targets: [
        { targetId: one, name: 'Allowed' },
        { targetId: two, name: 'Private' },
      ],
    });
    expect(await h.service.detail(one, user)).toMatchObject({
      canEdit: false,
      canWithdraw: false,
      targets: [{ targetId: one, name: 'Allowed' }],
    });
    await expect(h.service.update(one, body(), user)).rejects.toMatchObject({
      status: 404,
    });
    await expect(h.service.remove(one, user)).rejects.toMatchObject({
      status: 404,
    });
    expect(h.repository.update).not.toHaveBeenCalled();
    expect(h.repository.remove).not.toHaveBeenCalled();
  });
  it('preserves the original start when editing content and rejects withdrawn records', async () => {
    const h = setup();
    h.repository.find.mockResolvedValue({
      ...notice(one),
      scope: 'sites',
      status: 'active',
      targets: [{ targetId: one, name: 'Allowed' }],
    });
    await h.service.update(one, body(), user);
    expect(h.repository.update).toHaveBeenCalledWith(one, body(), instant, [
      one,
    ]);
    h.repository.find.mockResolvedValue({
      ...notice(one),
      scope: 'sites',
      status: 'withdrawn',
      targets: [{ targetId: one, name: 'Allowed' }],
    });
    await expect(h.service.update(one, body(), user)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('rejects inverted periods and inaccessible destination filters', async () => {
    const h = setup();
    await expect(
      h.service.list(
        Object.assign(new AnnouncementQueryDto(), {
          dateFrom: '2026-11-05T00:00:00Z',
          dateTo: '2026-11-04T00:00:00Z',
        }),
        user,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      h.service.list(
        Object.assign(new AnnouncementQueryDto(), { targetId: two }),
        user,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.repository.list).not.toHaveBeenCalled();
  });
  it.each([
    { sort: 'title;DROP TABLE' },
    { status: 'unknown' },
    { severity: 'fatal' },
    { targetId: 'invalid' },
    { dateFrom: '2026-11-04' },
    { search: 'x'.repeat(201) },
  ])('validates listing criteria %j', async (data) => {
    expect(
      await validate(plainToInstance(AnnouncementQueryDto, data)),
    ).not.toHaveLength(0);
  });
  it.each([
    { targetIds: [] },
    { targetIds: [one, one] },
    { targetIds: ['bad'] },
    { scope: 'everything' },
    { title: '  ' },
    { message: 'x'.repeat(2001) },
    { endsAt: '2026-11-04T12:00:00' },
  ])('validates malformed publication requests: %j', async (data) => {
    expect(
      await validate(
        plainToInstance(CreateAnnouncementDto, { ...body(), ...data }),
      ),
    ).not.toHaveLength(0);
  });
});

describe('local announcement source of truth', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(instant);
  });
  afterEach(() => jest.useRealTimers());
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  function setup(mode = 'intra') {
    const changes = new Subject<DatabaseChange>();
    const database = {
      query: jest.fn(async () => [
        { state_value: JSON.stringify([notice(one)]) },
      ]),
    };
    const repository = {
      nextBoundary: jest.fn<Promise<number | undefined>, []>(
        async () => undefined,
      ),
      forSite: jest.fn(async (id: string) =>
        id === one
          ? [notice(two, instant.getTime() + 1000, instant.getTime() + 2000)]
          : [notice(two)],
      ),
    };
    const events = {
      changes: (keys: string[]) =>
        changes.pipe(filter((change) => keys.includes(change.key))),
    };
    const service = new LocalAnnouncementsService(
      database as unknown as DataSource,
      events as DatabaseEventsService,
      { now: () => new Date() } as ClockService,
      { get: () => mode } as unknown as ConfigService,
      repository as unknown as AnnouncementsRepository,
    );
    return { changes, database, repository, service };
  }
  it('shares a snapshot per site, starts and expires notices with exact timers while the agent is offline', async () => {
    const h = setup();
    const first = jest.fn(),
      second = jest.fn();
    const a = h.service.stream(one).subscribe(first),
      b = h.service.stream(one).subscribe(second);
    await flush();
    expect(h.database.query).toHaveBeenCalledTimes(1);
    expect(first.mock.calls.at(-1)?.[0].data.items).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1011);
    expect(first.mock.calls.at(-1)?.[0].data.items).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1000);
    expect(first.mock.calls.at(-1)?.[0].data.items).toHaveLength(1);
    expect(second.mock.calls.at(-1)?.[0].data.items).toHaveLength(1);
    a.unsubscribe();
    b.unsubscribe();
    const reads = h.database.query.mock.calls.length;
    h.changes.next({ key: 'announcements' });
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.database.query).toHaveBeenCalledTimes(reads);
  });
  it('invalidates filtered administration lists at time boundaries without polling, sharing the timer', async () => {
    const h = setup('cloud');
    h.repository.nextBoundary
      .mockResolvedValueOnce(instant.getTime() + 1000)
      .mockResolvedValue(undefined);
    const authorize = jest.fn(async () => undefined),
      received = jest.fn();
    const first = h.service.streamAdministration(authorize).subscribe(received);
    const second = h.service.streamAdministration(authorize).subscribe();
    await jest.advanceTimersByTimeAsync(110);
    expect(h.repository.nextBoundary).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1100);
    expect(received).toHaveBeenCalledTimes(2);
    expect(h.repository.nextBoundary).toHaveBeenCalledTimes(2);
    first.unsubscribe();
    second.unsubscribe();
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.repository.nextBoundary).toHaveBeenCalledTimes(2);
  });
  it('does not read or expose the intra installation cache in the cloud', async () => {
    const h = setup('cloud');
    expect((await h.service.read()).items).toEqual([]);
    expect(h.database.query).not.toHaveBeenCalled();
    expect(h.repository.forSite).not.toHaveBeenCalled();
  });
  it('keeps site contexts independent while preserving global installation notices', async () => {
    const h = setup();
    const a = await h.service.read(one),
      b = await h.service.read(two);
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(2);
    expect(h.repository.forSite.mock.calls.map((call) => call[0])).toEqual([
      one,
      two,
    ]);
  });
  it('clears a withdrawn remote notice through the same database event stream', async () => {
    const h = setup();
    const received = jest.fn();
    const subscription = h.service.stream().subscribe(received);
    await flush();
    h.database.query.mockResolvedValue([{ state_value: '[]' }]);
    h.changes.next({ key: 'announcements' });
    await flush();
    expect(received.mock.calls.at(-1)?.[0].data.items).toEqual([]);
    subscription.unsubscribe();
  });
});

it('redacts inaccessible site names in administration and exposes withdrawal as read-only', async () => {
  const row = {
    announcement_id: one,
    scope: 'sites',
    title: 'Shared notice',
    message: 'Hello',
    severity: 'info',
    starts_at: instant,
    ends_at: new Date('2026-11-05T10:00:00Z'),
    created_at: instant,
    withdrawn_at: null,
    targets: [
      { targetId: one, name: 'Allowed' },
      { targetId: two, name: 'Private' },
    ],
  };
  const database = {
    query: jest
      .fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ total: 1 }]),
  };
  const repository = new AnnouncementsRepository(
    database as unknown as DataSource,
  );
  const result = await repository.list('sites', 1, 10, instant, [one]);
  expect(result.items[0]).toMatchObject({
    targets: [{ targetId: one, name: 'Allowed' }],
    canWithdraw: false,
  });
  expect(JSON.stringify(result)).not.toContain('Private');
});
