import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonResponseDto } from '../../persons/dto/person-response.dto';

export class AvailabilitySlotDto {
  @ApiProperty({ example: '08:00', description: 'Heure de début du créneau (HH:mm)' })
  time!: string;

  @ApiProperty({ example: 1, description: 'Capacité maximale d’inscriptions par créneau' })
  slotCapacity!: number;

  @ApiProperty({ example: 0, description: 'Nombre d’inscriptions déjà validées' })
  bookedCount!: number;

  @ApiProperty({ example: 1, description: 'Places restantes disponibles' })
  availableCount!: number;

  @ApiProperty({ example: false, description: 'Indique si le créneau est complet' })
  isFull!: boolean;
}

export class AvailabilityResponseDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: '2026-09-20' })
  date!: string;

  @ApiProperty({ example: 15, description: 'Durée d’un créneau en minutes' })
  slotDuration!: number;

  @ApiProperty({ type: [AvailabilitySlotDto] })
  slots!: AvailabilitySlotDto[];
}

export class RegistrationTierSummaryDto {
  @ApiProperty({ example: 1 })
  tierId!: number;

  @ApiProperty({ example: 'free' })
  tierCode!: string;

  @ApiPropertyOptional({ example: 0, nullable: true })
  price?: number;

  @ApiPropertyOptional({ example: 'TND', nullable: true })
  currency?: string;
}

export class RegistrationCreatedResponseDto {
  @ApiProperty({ example: 101 })
  registrationId!: number;

  @ApiProperty({ example: 'MED001' })
  ticketNumber!: string;

  @ApiProperty({ example: '2026-09-20' })
  businessDate!: string;

  @ApiProperty({ example: 'walkin', enum: ['walkin', 'appointment'] })
  entryType!: string;

  @ApiPropertyOptional({ example: 'booked', enum: ['booked', 'checked_in', 'expired', null], nullable: true })
  appointmentStatus?: string | null;

  @ApiPropertyOptional({ example: '2026-09-20T09:30:00.000Z', nullable: true })
  scheduledTime?: string | null;

  @ApiProperty({ example: 'waiting', enum: ['waiting', 'in_progress', 'served', 'no_show', 'expired'] })
  status!: string;

  @ApiProperty({ type: RegistrationTierSummaryDto })
  tier!: RegistrationTierSummaryDto;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  priorityReferenceTime!: string;

  @ApiPropertyOptional({ example: 'https://suivi.dori.tn/#token123', nullable: true })
  trackingUrl?: string;

  @ApiProperty({ example: '2026-09-20T23:59:59.000Z' })
  registrationTrackingTokenValidUntil!: string;
}

export class QueueHeaderSummaryDto {
  @ApiProperty({ example: 'MED-01' })
  queueCode!: string;

  @ApiPropertyOptional({ example: 'Médecine Générale', nullable: true })
  queueName?: string | null;
}

export class QueueTierFullSummaryDto {
  @ApiProperty({ example: 1 })
  tierId!: number;

  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 0 })
  price!: number;

  @ApiProperty({ example: 'TND' })
  currency!: string;

  @ApiProperty({ type: RegistrationTierSummaryDto })
  tier!: RegistrationTierSummaryDto;
}

export class RegistrationDetailDto {
  @ApiProperty({ example: 101 })
  customerId!: number;

  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 1 })
  tierId!: number;

  @ApiProperty({ example: '2026-09-20T00:00:00.000Z' })
  businessDate!: Date;

  @ApiProperty({ example: 'MED001' })
  ticketNumber!: string;

  @ApiProperty({ example: 'walkin', enum: ['walkin', 'appointment'] })
  entryType!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  scheduledTime?: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  appointmentStatus?: string | null;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  priorityReferenceTime!: Date;

  @ApiProperty({ example: 'waiting', enum: ['waiting', 'in_progress', 'served', 'no_show', 'expired'] })
  status!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  calledAt?: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  servedAt?: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  closedAt?: Date | null;

  @ApiProperty({ type: PersonResponseDto })
  person!: PersonResponseDto;

  @ApiProperty({ type: QueueHeaderSummaryDto })
  queue!: QueueHeaderSummaryDto;

  @ApiPropertyOptional({ type: QueueTierFullSummaryDto, nullable: true })
  queueTier?: QueueTierFullSummaryDto | null;
}

export class RescheduleResponseDto {
  @ApiProperty({ example: 101 })
  registrationId!: number;

  @ApiProperty({ example: 'booked' })
  appointmentStatus!: string;

  @ApiProperty({ example: '2026-09-20T11:00:00.000Z' })
  scheduledTime!: string;

  @ApiProperty({ example: '2026-09-20T11:00:00.000Z' })
  priorityReferenceTime!: string;
}

export class CheckInResponseDto {
  @ApiProperty({ example: 101 })
  registrationId!: number;

  @ApiProperty({ example: 'checked_in' })
  appointmentStatus!: string;

  @ApiProperty({ example: '2026-09-20T09:15:00.000Z' })
  checkedInAt!: string;
}

export class PublicPositionResponseDto {
  @ApiProperty({ example: 'MED001' })
  ticketNumber!: string;

  @ApiProperty({ example: 'waiting', enum: ['waiting', 'in_progress', 'served', 'no_show', 'expired', 'closed'] })
  status!: string;

  @ApiPropertyOptional({ example: 3, description: 'Position courante dans la file d’attente' })
  position?: number;

  @ApiPropertyOptional({ example: 20, description: 'Temps d’attente estimé en minutes' })
  estimatedWaitMinutes?: number;
}
