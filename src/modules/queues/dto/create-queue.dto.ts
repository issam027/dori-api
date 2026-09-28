import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQueueDto {
  @ApiProperty({
    example: 'MED',
    description: 'Code unique de la queue (max 10 caractères)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  queueCode: string;

  @ApiPropertyOptional({
    example: 'Médecine Générale',
    description: 'Nom affiché de la queue',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  queueName?: string;

  @ApiPropertyOptional({
    default: 10,
    description: "Temps d'attente moyen estimé (minutes)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  averageWaitTime?: number;

  @ApiPropertyOptional({
    default: 1,
    description: 'Nombre de guichets (threads) actifs',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  threadCount?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  appointmentsEnabled?: boolean;

  @ApiPropertyOptional({
    default: 15,
    description: "Durée d'un créneau (minutes)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  appointmentSlotDuration?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  slotCapacity?: number;

  @ApiPropertyOptional({ example: '08:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  workingHoursStart?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  workingHoursEnd?: string;

  @ApiPropertyOptional({ example: '12:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  breakStart?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  breakEnd?: string;

  @ApiPropertyOptional({
    default: 60,
    description: 'Tolérance retard RDV (minutes)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  lateToleranceMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  baseWeightWalkin?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsNumber()
  @IsOptional()
  baseWeightAppointment?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @IsOptional()
  escalationRateWalkin?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @IsOptional()
  escalationRateAppointment?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  carryOverWaiting?: boolean;

  @ApiPropertyOptional({
    enum: ['close_all', 'close_served_only'],
    default: 'close_all',
  })
  @IsIn(['close_all', 'close_served_only'])
  @IsOptional()
  dailyResetMode?: 'close_all' | 'close_served_only';

  @ApiPropertyOptional({ example: '03:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  dailyResetTime?: string;
}
