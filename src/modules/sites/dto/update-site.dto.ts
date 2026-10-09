import { PartialType } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {
  @ApiPropertyOptional({ description: 'Activer / désactiver le site' })
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
