import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationCustomerSummaryDto {
  @ApiProperty({ example: 'MED001' })
  ticketNumber!: string;

  @ApiProperty({ example: 1 })
  queueId!: number;
}

export class NotificationResponseDto {
  @ApiProperty({ example: 1 })
  notificationId!: number;

  @ApiProperty({ example: 101 })
  customerId!: number;

  @ApiProperty({ example: 'sms', enum: ['sms', 'email', 'voice'] })
  channel!: string;

  @ApiProperty({ example: '+21698123456' })
  recipient!: string;

  @ApiProperty({ example: 'Votre ticket MED001 est prêt à être appelé au guichet 2.' })
  payload!: string;

  @ApiProperty({ example: 'sent', enum: ['pending', 'sent', 'delivered', 'failed'] })
  notificationStatus!: string;

  @ApiProperty({ example: 1 })
  attemptCount!: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  failureReason?: string | null;

  @ApiPropertyOptional({ example: 'MSG-987654321', nullable: true })
  providerMessageId?: string | null;

  @ApiPropertyOptional({ type: NotificationCustomerSummaryDto })
  customer?: NotificationCustomerSummaryDto;

  @ApiPropertyOptional({ example: '2026-09-20T08:30:00.000Z', nullable: true })
  sentAt?: Date | null;

  @ApiPropertyOptional({ example: '2026-09-20T08:30:05.000Z', nullable: true })
  deliveredAt?: Date | null;

  @ApiProperty({ example: '2026-09-20T08:29:55.000Z' })
  createdAt!: Date;
}
