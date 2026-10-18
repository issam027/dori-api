import { PERMISSIONS_KEY } from '../../core/rbac/decorators/require-permission.decorator';
import { QueueEngineController } from './queue-engine.controller';

describe('QueueEngineController permissions', () => {
  it('requires view and call permissions for next preview', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        QueueEngineController.prototype.nextPreview,
      ),
    ).toEqual(['queue_view', 'registration_call']);
  });
});
