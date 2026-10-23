import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQueueDto } from './create-queue.dto';
import {
  IsUUID,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/pagination/pagination.dto';
import { strictBoolean } from '../../../core/validation/strict-boolean.transformer';

export class UpdateQueueDto extends PartialType(CreateQueueDto) {
  @ApiPropertyOptional({ description: 'Activer / désactiver la queue' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class QueueFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrer par site', example: 1 })
  @IsUUID()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Recherche libre (nom, code)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrer par statut actif' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  isActive?: boolean;
}

export class AssignOperatorDto {
  @ApiProperty({
    description: "ID de l'opérateur ou de la borne à affecter",
    example: 3,
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
