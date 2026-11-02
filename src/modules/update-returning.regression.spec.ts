import { DataSource, EntityManager } from 'typeorm';
import { PersonsRepository } from './persons/persons.repository';
import { SitesRepository } from './sites/sites.repository';
import { RegistrationsRepository } from './registrations/registrations.repository';
import { ServiceTiersRepository } from './service-tiers/service-tiers.repository';
import { NotificationsRepository } from './notifications/notifications.repository';
import { EdgeControlRepository } from './edge-control/edge-control.repository';
import { TranslationsRepository } from './translations/translations.repository';
import { QueuesRepository } from './queues/queues.repository';

const now = new Date('2026-11-02T12:00:00Z');
const row = {
  person_id: 'person',
  note_id: 'note',
  category: 'ihm',
  content: 'Updated',
};
function database(updated: unknown) {
  const query = jest.fn(async (sql: string) => {
    if (/^\s*SELECT/.test(sql)) return [row];
    if (/^\s*INSERT/.test(sql)) return [{ version: 1, event_id: 'event' }];
    return updated;
  });
  return {
    query,
    transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
      work({ query } as unknown as EntityManager),
  } as unknown as DataSource;
}
const mutations: Array<[string, (source: DataSource) => Promise<unknown>]> = [
  [
    'person',
    (source) => new PersonsRepository(source).update('person', {}, 'user', now),
  ],
  [
    'note',
    (source) =>
      new PersonsRepository(source).updateNote(
        'person',
        'note',
        { content: 'Updated' },
        'user',
        now,
      ),
  ],
  [
    'site',
    (source) => new SitesRepository(source).update('site', {}, 'user', now),
  ],
  [
    'registration',
    (source) =>
      new RegistrationsRepository(source).update(
        'registration',
        {},
        'user',
        now,
      ),
  ],
  [
    'service',
    (source) =>
      new ServiceTiersRepository(source).updateTier('tier', {}, 'user', now),
  ],
  [
    'notification resend',
    (source) =>
      new NotificationsRepository(source).markPending('notification', now),
  ],
  [
    'installation status',
    (source) =>
      new EdgeControlRepository(source).updateDeploymentStatus(
        'installation',
        'active',
      ),
  ],
  [
    'translation',
    async (source) =>
      (
        await new TranslationsRepository(source).update(
          'translation',
          {},
          'user',
          now,
        )
      )?.item,
  ],
];
describe.each(['flat', 'tuple'])(
  'mutation results with %s database returns',
  (shape) => {
    it.each(mutations)(
      'returns the updated %s object',
      async (_name, mutate) => {
        await expect(
          mutate(database(shape === 'tuple' ? [[row], 1] : [row])),
        ).resolves.toEqual(row);
      },
    );
    it('does not report a missing note as deleted', async () => {
      await expect(
        new PersonsRepository(
          database(shape === 'tuple' ? [[], 0] : []),
        ).deleteNote('person', 'note', 'user', now),
      ).resolves.toBe(false);
    });
    it('does not report a missing queue as updated', async () => {
      await expect(
        new QueuesRepository(database(shape === 'tuple' ? [[], 0] : [])).update(
          'queue',
          {},
          'user',
          now,
        ),
      ).resolves.toBe(false);
    });
    it('does not report an unmatched provider callback as delivered', async () => {
      await expect(
        new NotificationsRepository(
          database(shape === 'tuple' ? [[], 0] : []),
        ).applyWebhook(
          'provider',
          'event',
          { messageId: 'missing', status: 'delivered' },
          now,
        ),
      ).resolves.toBe('missing');
    });
  },
);
