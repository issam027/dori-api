import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO4217CurrencyCode,
  IsLocale,
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
    example: 10,
    description: "Temps d'attente moyen estimé (minutes)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  averageWaitTime?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Nombre de guichets (threads) actifs',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  threadCount?: number;

  @ApiPropertyOptional({
    example: 'EUR',
    nullable: true,
    description:
      'Surcharge de la devise ISO 4217 du site ; null ou absence = héritage du site',
  })
  @IsISO4217CurrencyCode()
  @IsOptional()
  currency?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  appointmentsEnabled?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "Durée d'un créneau (minutes)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  appointmentSlotDuration?: number;

  @ApiPropertyOptional({ example: 1 })
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
    example: 60,
    description: 'Tolérance retard RDV (minutes)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  lateToleranceMinutes?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  baseWeightWalkin?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsNumber()
  @IsOptional()
  baseWeightAppointment?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  escalationRateWalkin?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  escalationRateAppointment?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  carryOverWaiting?: boolean;

  @ApiPropertyOptional({
    enum: ['close_all', 'close_served_only'],
    example: 'close_all',
  })
  @IsIn(['close_all', 'close_served_only'])
  @IsOptional()
  dailyResetMode?: 'close_all' | 'close_served_only';

  @ApiPropertyOptional({ example: '03:00' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  dailyResetTime?: string;

  @ApiPropertyOptional({
    example: 'fr-FR',
    nullable: true,
    description:
      'Surcharge de la locale du site ; null ou absence = héritage du site',
  })
  @IsLocale()
  @MaxLength(10)
  @IsOptional()
  locale?: string | null;
}
