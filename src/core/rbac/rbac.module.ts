import { Global, Module } from '@nestjs/common';
import { ScopeService } from './scope.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [ScopeService, PermissionsGuard],
  exports: [ScopeService, PermissionsGuard],
})
export class RbacModule {}
