import { Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';
import { ScopeService } from './services/scope.service';
import { DatabaseModule } from '../database/database.module';
import { ScopeRepository } from './repositories/scope.repository';

@Module({
  imports: [DatabaseModule],
  providers: [PermissionsGuard, ScopeService, ScopeRepository],
  exports: [PermissionsGuard, ScopeService],
})
export class RbacModule {}
