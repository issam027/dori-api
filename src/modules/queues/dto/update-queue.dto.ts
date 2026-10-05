import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQueueDto } from './create-queue.dto';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class UpdateQueueDto extends PartialType(CreateQueueDto) {
  @ApiPropertyOptional({ description: 'Activer / désactiver la queue' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class QueueFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrer par site', example: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  siteId?: number;

  @ApiPropertyOptional({ description: 'Recherche libre (nom, code)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrer par statut actif' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class AssignOperatorDto {
  @ApiProperty({
    description: "ID de l'opérateur à affecter",
    example: 3,
  })
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
