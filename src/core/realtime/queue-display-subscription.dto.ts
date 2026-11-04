import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueueDisplaySubscriptionDto {
  @ApiProperty({
    type: String,
    description: 'Comma-separated queue UUIDs, at most 100',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [...new Set(value.split(','))] : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  queueIds: string[];
}
