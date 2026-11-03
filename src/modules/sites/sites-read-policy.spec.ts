import { SitesController } from './sites.controller';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../../core/rbac/decorators/require-permission.decorator';

describe('site context read policy', () => {
  it('lets an operator read scoped site context without granting site administration', () => {
    for (const method of [
      SitesController.prototype.findSites,
      SitesController.prototype.findSite,
    ]) {
      expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, method)).toEqual([
        'site_view',
        'session_operate',
      ]);
    }
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        SitesController.prototype.updateSite,
      ),
    ).toEqual(['site_edit']);
  });
});
