import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRepository } from './audit.repository';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditRepository, AuditInterceptor],
  exports: [AuditRepository, AuditInterceptor],
})
export class AuditModule {}
