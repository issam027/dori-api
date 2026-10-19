import { PartialType } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/pagination/pagination.dto';
import { strictBoolean } from '../../../core/validation/strict-boolean.transformer';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {
  @ApiPropertyOptional({ description: 'Activer / désactiver le site' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SiteFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtrer les sites par statut. Sans ce paramètre, les sites actifs et inactifs sont retournés.',
  })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class DirectSiteUserFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['admin', 'manager'],
    description: 'Filtrer les utilisateurs directs par rôle',
  })
  @IsIn(['admin', 'manager'])
  @IsOptional()
  role?: 'admin' | 'manager';
}

export class AssignDirectSiteUserDto {
  @ApiProperty({
    description: "ID de l'utilisateur à affecter au site",
    example: 2,
  })
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
