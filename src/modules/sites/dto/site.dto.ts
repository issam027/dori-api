import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'Clinique Pasteur' })
  @IsString()
  @IsNotEmpty()
  siteName!: string;

  @ApiPropertyOptional({ example: 'Tunis, Berges du Lac' })
  @IsOptional()
  @IsString()
  siteLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteLogoUrl?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'public' })
  @IsOptional()
  @IsIn(['public', 'private'])
  siteType?: string;

  @ApiPropertyOptional({ default: 'Africa/Tunis' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: 'TND' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  // Configuration RDV par défaut
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  defaultAppointmentsEnabled?: boolean;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultAppointmentSlotDuration?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultSlotCapacity?: number;

  @ApiPropertyOptional({ default: '08:00' })
  @IsOptional()
  @IsString()
  defaultWorkingHoursStart?: string;

  @ApiPropertyOptional({ default: '17:00' })
  @IsOptional()
  @IsString()
  defaultWorkingHoursEnd?: string;

  @ApiPropertyOptional({ default: '12:00' })
  @IsOptional()
  @IsString()
  defaultBreakStart?: string;

  @ApiPropertyOptional({ default: '14:00' })
  @IsOptional()
  @IsString()
  defaultBreakEnd?: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  defaultLateToleranceMinutes?: number;

  // Clôture quotidienne par défaut
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  defaultCarryOverWaiting?: boolean;

  @ApiPropertyOptional({ enum: ['close_all', 'close_served_only'], default: 'close_all' })
  @IsOptional()
  @IsIn(['close_all', 'close_served_only'])
  defaultDailyResetMode?: string;

  @ApiPropertyOptional({ default: '03:00' })
  @IsOptional()
  @IsString()
  defaultDailyResetTime?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  defaultLocale?: string;
}

export class UpdateSiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteLogoUrl?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @IsIn(['public', 'private'])
  siteType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  defaultAppointmentsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultAppointmentSlotDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultSlotCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultWorkingHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultWorkingHoursEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBreakStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBreakEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultLateToleranceMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  defaultCarryOverWaiting?: boolean;

  @ApiPropertyOptional({ enum: ['close_all', 'close_served_only'] })
  @IsOptional()
  @IsIn(['close_all', 'close_served_only'])
  defaultDailyResetMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultDailyResetTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLocale?: string;
}

export class AssignManagerDto {
  @ApiProperty({ example: 7 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;
}
