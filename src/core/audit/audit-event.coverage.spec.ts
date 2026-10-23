import 'reflect-metadata';
import { PersonsController } from '../../modules/persons/persons.controller';
import { QueuesController } from '../../modules/queues/queues.controller';
import { SitesController } from '../../modules/sites/sites.controller';
import { UsersController } from '../../modules/users/users.controller';
import { AUDIT_EVENT_KEY, AuditEventDefinition } from './audit-event.decorator';

describe('sensitive business audit coverage', () => {
  const cases: Array<[object, string, string]> = [
    [UsersController.prototype, 'updateUserStatus', 'user.status.update'],
    [UsersController.prototype, 'deleteUser', 'user.delete'],
    [UsersController.prototype, 'setUserPassword', 'user.password.reset'],
    [UsersController.prototype, 'assignUserRole', 'user.role.assign'],
    [UsersController.prototype, 'removeUserRole', 'user.role.remove'],
    [
      UsersController.prototype,
      'updateRolePermissions',
      'role.permissions.update',
    ],
    [SitesController.prototype, 'createSite', 'site.create'],
    [SitesController.prototype, 'updateSite', 'site.update'],
    [SitesController.prototype, 'deleteSite', 'site.delete'],
    [SitesController.prototype, 'assignDirectUser', 'site.user.assign'],
    [SitesController.prototype, 'removeDirectUser', 'site.user.remove'],
    [QueuesController.prototype, 'remove', 'queue.delete'],
    [QueuesController.prototype, 'reset', 'queue.reset'],
    [QueuesController.prototype, 'assignOperator', 'queue.operator.assign'],
    [QueuesController.prototype, 'removeOperator', 'queue.operator.remove'],
    [PersonsController.prototype, 'findOne', 'person.read'],
    [PersonsController.prototype, 'getNotes', 'person.notes.read'],
    [PersonsController.prototype, 'createNote', 'person.note.create'],
    [PersonsController.prototype, 'updateNote', 'person.note.update'],
    [PersonsController.prototype, 'deleteNote', 'person.note.delete'],
    [PersonsController.prototype, 'deletePerson', 'person.delete'],
  ];

  it.each(cases)('%s.%s emits %s', (prototype, method, action) => {
    const definition = Reflect.getMetadata(
      AUDIT_EVENT_KEY,
      prototype[method as keyof typeof prototype],
    ) as AuditEventDefinition | undefined;

    expect(definition?.action).toBe(action);
    expect(definition?.targetType).toBeTruthy();
  });
});
