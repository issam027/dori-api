import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MonitoringLiveQueryDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @IsUUID()
  siteId: string;
}
