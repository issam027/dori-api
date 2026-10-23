import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRepository } from './audit.repository';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { RbacModule } from '../rbac/rbac.module';

@Global()
@Module({
  imports: [DatabaseModule, RbacModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService, AuditInterceptor],
  exports: [AuditRepository, AuditService, AuditInterceptor],
})
export class AuditModule {}
