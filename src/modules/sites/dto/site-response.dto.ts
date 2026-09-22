import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SiteResponseDto {
  @ApiProperty({ example: 1 })
  siteId!: number;

  @ApiProperty({ example: 'Clinique Pasteur' })
  siteName!: string;

  @ApiPropertyOptional({ example: 'Tunis, Berges du Lac', nullable: true })
  siteLocation?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.dori.tn/logos/pasteur.png', nullable: true })
  siteLogoUrl?: string | null;

  @ApiProperty({ example: 'public', enum: ['public', 'private'] })
  siteType!: string;

  @ApiProperty({ example: 'Africa/Tunis' })
  timezone!: string;

  @ApiProperty({ example: 'TND' })
  defaultCurrency!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  defaultAppointmentsEnabled!: boolean;

  @ApiProperty({ example: 15 })
  defaultAppointmentSlotDuration!: number;

  @ApiProperty({ example: 1 })
  defaultSlotCapacity!: number;

  @ApiProperty({ example: '08:00' })
  defaultWorkingHoursStart!: string;

  @ApiProperty({ example: '17:00' })
  defaultWorkingHoursEnd!: string;

  @ApiPropertyOptional({ example: '12:00', nullable: true })
  defaultBreakStart?: string | null;

  @ApiPropertyOptional({ example: '14:00', nullable: true })
  defaultBreakEnd?: string | null;

  @ApiProperty({ example: 60 })
  defaultLateToleranceMinutes!: number;

  @ApiProperty({ example: false })
  defaultCarryOverWaiting!: boolean;

  @ApiProperty({ example: 'close_all', enum: ['close_all', 'close_served_only'] })
  defaultDailyResetMode!: string;

  @ApiProperty({ example: '03:00' })
  defaultDailyResetTime!: string;

  @ApiProperty({ example: 'fr' })
  defaultLocale!: string;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  updatedAt!: Date;
}

export class SiteManagerDto {
  @ApiProperty({ example: 7 })
  userId!: number;

  @ApiProperty({ example: 'manager_pasteur' })
  username!: string;

  @ApiPropertyOptional({ example: 'manager@pasteur.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'] })
  userType!: string;
}

export class SiteManagerAssignmentResponseDto {
  @ApiProperty({ example: 7 })
  userId!: number;

  @ApiProperty({ example: 1 })
  siteId!: number;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  assignedAt!: Date;
}
