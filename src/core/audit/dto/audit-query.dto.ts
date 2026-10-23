import {
  IsUUID,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../pagination/pagination.dto';
import {
  DATE_RANGE_LIMITS,
  IsCalendarDate,
  ValidDateRange,
} from '../../dates/date-range.dto';
import { AuditOutcome } from '../audit.repository';

@ValidDateRange(DATE_RANGE_LIMITS.auditFilterDays)
export class AuditEventQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 3, description: 'Scope du site historisé' })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ example: 7, description: "ID de l'acteur" })
  @IsUUID()
  @IsOptional()
  actorUserId?: string;

  @ApiPropertyOptional({ example: 'site.create' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ example: 'site' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional({ example: '42' })
  @IsString()
  @MaxLength(128)
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ enum: ['success', 'failure'] })
  @IsIn(['success', 'failure'])
  @IsOptional()
  outcome?: AuditOutcome;

  @ApiPropertyOptional({ example: 'corr-01JXYZ' })
  @IsString()
  @MaxLength(128)
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @ApiPropertyOptional({
    example: 'site',
    minLength: 2,
    maxLength: 100,
    description:
      'Recherche dans les libellés humains, action, type/cibles, corrélation et chemin HTTP',
  })
  @IsString()
  @Length(2, 100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: '2026-10-01', format: 'date' })
  @IsCalendarDate()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31', format: 'date' })
  @IsCalendarDate()
  @IsOptional()
  dateTo?: string;
}
