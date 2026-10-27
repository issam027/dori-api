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

  it('requires session operation permission for recall', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        QueueEngineController.prototype.recall,
      ),
    ).toEqual(['session_operate']);
  });

  it('requires registration call permission for site next and cockpit', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        QueueEngineController.prototype.callNextForSite,
      ),
    ).toEqual(['registration_call']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        QueueEngineController.prototype.getCockpit,
      ),
    ).toEqual(['registration_call']);
  });
});
