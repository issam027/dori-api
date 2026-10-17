import { PERMISSIONS_KEY } from '../../core/rbac/decorators/require-permission.decorator';
import { QueuesController } from './queues.controller';

describe('QueuesController permissions', () => {
  it('requires queue_reset for the manual reset endpoint', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      QueuesController.prototype.reset,
    );

    expect(permissions).toEqual(['queue_reset']);
  });
});
