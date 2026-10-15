import { PartialType } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional } from 'class-validator';
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
    default: true,
    description: 'Filtrer les sites actifs ou désactivés',
  })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignManagerDto {
  @ApiProperty({
    description: "ID de l'utilisateur à affecter au site",
    example: 2,
  })
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
