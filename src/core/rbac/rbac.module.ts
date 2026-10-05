import { Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';
import { ScopeService } from './services/scope.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PermissionsGuard, ScopeService],
  exports: [PermissionsGuard, ScopeService],
})
export class RbacModule {}
