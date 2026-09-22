import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ClockService],
  exports: [UsersService],
})
export class UsersModule {}
