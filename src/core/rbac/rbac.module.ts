import { Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';
import { ScopeService } from './services/scope.service';
import { DatabaseModule } from '../database/database.module';
import { ScopeRepository } from './repositories/scope.repository';
import { RedisModule } from '../redis/redis.module';
import { RankService } from './services/rank.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [PermissionsGuard, ScopeService, ScopeRepository, RankService],
  exports: [PermissionsGuard, ScopeService, RankService],
})
export class RbacModule {}
