import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type AnnouncementSeverity = 'info' | 'warning' | 'critical';
export type AnnouncementScope = 'installations' | 'sites';
export const announcementSorts = [
  'createdAt:desc',
  'createdAt:asc',
  'title:asc',
  'title:desc',
  'startsAt:asc',
  'startsAt:desc',
  'endsAt:asc',
  'endsAt:desc',
] as const;
export type AnnouncementSort = (typeof announcementSorts)[number];
export class CreateAnnouncementDto {
  @ApiProperty({ enum: ['installations', 'sites'] })
  @IsIn(['installations', 'sites'])
  scope!: AnnouncementScope;
  @ApiProperty({ type: [String], maxItems: 1000 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  targetIds!: string[];
  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;
  @ApiProperty({ maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  @IsIn(['info', 'warning', 'critical'])
  severity!: AnnouncementSeverity;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'UTC or offset date; defaults to now',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;
}
export class UpdateAnnouncementDto extends OmitType(CreateAnnouncementDto, [
  'scope',
] as const) {}
export class AnnouncementQueryDto {
  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Search in the title and message (literal, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
  @ApiPropertyOptional({
    enum: ['scheduled', 'active', 'expired', 'withdrawn'],
  })
  @IsOptional()
  @IsIn(['scheduled', 'active', 'expired', 'withdrawn'])
  status?: 'scheduled' | 'active' | 'expired' | 'withdrawn';
  @ApiPropertyOptional({ enum: ['info', 'warning', 'critical'] })
  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: AnnouncementSeverity;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Target site or installation in the selected scope',
  })
  @IsOptional()
  @IsUUID('4')
  targetId?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Include announcements whose display period ends on or after this instant (timezone required)',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  dateFrom?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Include announcements whose display period starts on or before this instant (timezone required)',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  dateTo?: string;
  @ApiPropertyOptional({ enum: announcementSorts, default: 'createdAt:desc' })
  @IsOptional()
  @IsIn(announcementSorts)
  sort: AnnouncementSort = 'createdAt:desc';
  @ApiPropertyOptional({ enum: ['installations', 'sites'], default: 'sites' })
  @IsOptional()
  @IsIn(['installations', 'sites'])
  scope: AnnouncementScope = 'sites';
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;
}
export class AnnouncementItemDto {
  @ApiProperty({ format: 'uuid' }) announcementId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severity!: AnnouncementSeverity;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
}
export class AnnouncementTargetItemDto {
  @ApiProperty({ format: 'uuid' }) targetId!: string;
  @ApiProperty() name!: string;
}
export class AnnouncementResponseDto extends AnnouncementItemDto {
  @ApiProperty({ enum: ['installations', 'sites'] }) scope!: AnnouncementScope;
  @ApiProperty() canWithdraw!: boolean;
  @ApiProperty() canEdit!: boolean;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: [AnnouncementTargetItemDto] })
  targets!: AnnouncementTargetItemDto[];
  @ApiProperty({ enum: ['scheduled', 'active', 'expired', 'withdrawn'] })
  status!: 'scheduled' | 'active' | 'expired' | 'withdrawn';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class PaginatedAnnouncementResponseDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ type: [AnnouncementResponseDto] })
  items!: AnnouncementResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalPages!: number;
}
export class LocalAnnouncementsResponseDto {
  @ApiProperty({ type: [AnnouncementItemDto] })
  items!: AnnouncementItemDto[];
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
}
export class WithdrawAnnouncementResponseDto {
  @ApiProperty({ format: 'uuid' }) announcementId!: string;
}
export class PublicAnnouncementsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  siteId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  queueId?: string;
}
