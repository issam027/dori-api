import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
export class AnnouncementQueryDto {
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
