import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class DailyQueueReportQueryDto {
  @ApiProperty({
    example: '2026-09-27',
    description: "Date d'activité (format YYYY-MM-DD)",
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;
}

export class ReportQueryDto extends DailyQueueReportQueryDto {}

export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: 'Filtrer par site spécifique (optionnel)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId?: number;
}

export class DashboardQueueLoadQueryDto {
  @ApiPropertyOptional({
    type: Number,
    example: 4,
    default: 4,
    description: 'Nombre maximum de files à retourner (par défaut 4)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 4;

  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: 'Filtrer par site spécifique',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId?: number;
}
