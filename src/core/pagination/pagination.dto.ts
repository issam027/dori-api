import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Convertit un nom de champ camelCase en snake_case.
 * Ex : createdAt → created_at, siteId → site_id
 */
function toSnakeCase(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export class LimitQueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 100,
    description: 'Nombre maximum de résultats à retourner',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description:
      'field:asc|desc — le champ peut être en camelCase ou snake_case',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  parsedSort(): { field: string; direction: 'ASC' | 'DESC' } | null {
    if (!this.sort) return null;
    const [field, dir] = this.sort.split(':');
    const direction =
      dir?.toUpperCase() === 'DESC' ? ('DESC' as const) : ('ASC' as const);
    // Convertir camelCase → snake_case pour correspondre aux colonnes SQL
    const snakeField = toSnakeCase(field);
    return { field: snakeField, direction };
  }

  getParams(
    defaultSortField: string = 'created_at',
    defaultSortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const page = Number(this.page) || 1;
    const pageSize = Number(this.pageSize) || 25;
    const offset = (page - 1) * pageSize;
    const parsed = this.parsedSort();
    const sortField = parsed ? parsed.field : defaultSortField;
    const sortOrder = parsed ? parsed.direction : defaultSortOrder;
    return { page, pageSize, offset, sortField, sortOrder };
  }

  /**
   * VAL-01 — Retourne le champ de tri sécurisé via allowlist.
   * Si le champ demandé n'est pas dans `allowedFields`, on retourne `defaultField`.
   * Protège contre l'injection SQL et les crashes 500 sur des colonnes inconnues.
   *
   * @param allowedFields  Liste blanche des colonnes autorisées (noms exacts en base)
   * @param defaultField   Colonne utilisée si le champ demandé est absent de l'allowlist
   */
  getSafeSortField(allowedFields: string[], defaultField: string): string {
    const parsed = this.parsedSort();
    if (!parsed) return defaultField;
    return allowedFields.includes(parsed.field) ? parsed.field : defaultField;
  }

  createResponse<T>(items: T[], total: number): PaginatedResult<T> {
    const page = Number(this.page) || 1;
    const pageSize = Number(this.pageSize) || 25;
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / (pageSize || 1)),
    };
  }
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export abstract class PaginatedResponseDto {
  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille de page' })
  pageSize: number;

  @ApiProperty({ example: 100, description: "Nombre total d'éléments" })
  total: number;

  @ApiProperty({ example: 4, description: 'Nombre total de pages' })
  totalPages: number;
}
