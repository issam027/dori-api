import { PERMISSIONS_KEY } from '../../core/rbac/decorators/require-permission.decorator';
import { EdgeAdminController } from './edge-admin.controller';

describe('EdgeAdminController authorization', () => {
  it('requires the dedicated edge installation permission', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, EdgeAdminController)).toEqual([
      'edge_installation_manage',
    ]);
  });
});
