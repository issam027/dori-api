import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  IsIn,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQueueDto {
  @ApiProperty({ example: 'PED', description: 'Code préfixe unique de la file sur le site' })
  @IsString()
  @IsNotEmpty()
  queueCode!: string;

  @ApiPropertyOptional({ example: 'Pédiatrie' })
  @IsOptional()
  @IsString()
  queueName?: string;

  @ApiPropertyOptional({ default: 10, description: 'Temps moyen de traitement en minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  averageWaitTime?: number;

  @ApiPropertyOptional({ default: 1, description: 'Nombre de guichets simultanés' })
  @IsOptional()
  @IsInt()
  @Min(1)
  threadCount?: number;

  // Surcharges RDV (optionnelles, NULL = hérite)
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  appointmentsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  appointmentSlotDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  slotCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breakStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breakEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  lateToleranceMinutes?: number;

  // Surcharges Priorité
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baseWeightWalkin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baseWeightAppointment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  escalationRateWalkin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  escalationRateAppointment?: number;

  // Surcharges Clôture
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  carryOverWaiting?: boolean;

  @ApiPropertyOptional({ enum: ['close_all', 'close_served_only'] })
  @IsOptional()
  @IsIn(['close_all', 'close_served_only'])
  dailyResetMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dailyResetTime?: string;
}

export class UpdateQueueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  queueName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  averageWaitTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  threadCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  appointmentsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  appointmentSlotDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  slotCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHoursEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breakStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  breakEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  lateToleranceMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baseWeightWalkin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baseWeightAppointment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  escalationRateWalkin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  escalationRateAppointment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  carryOverWaiting?: boolean;

  @ApiPropertyOptional({ enum: ['close_all', 'close_served_only'] })
  @IsOptional()
  @IsIn(['close_all', 'close_served_only'])
  dailyResetMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dailyResetTime?: string;
}

export class AssignOperatorDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;
}
