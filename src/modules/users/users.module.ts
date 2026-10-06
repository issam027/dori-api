import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RbacModule } from '../../core/rbac/rbac.module';
import { ConfigModule } from '@nestjs/config';
import { UsersRepository } from './users.repository';

@Module({
  imports: [ConfigModule, DatabaseModule, ClockModule, RbacModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
