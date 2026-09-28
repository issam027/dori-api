import { Global, Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';
import { ScopeService } from './services/scope.service';

@Global()
@Module({
  providers: [PermissionsGuard, ScopeService],
  exports: [PermissionsGuard, ScopeService],
})
export class RbacModule {}
