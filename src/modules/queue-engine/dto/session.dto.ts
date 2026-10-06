import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidSessionMode } from '../../../core/validation/domain-validation.decorators';

@ValidSessionMode()
export class OpenSessionDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Numéro du guichet (thread) à ouvrir (requis si mode=active)',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  threadNumber?: number;

  @ApiPropertyOptional({
    enum: ['active', 'consultation_only'],
    default: 'active',
    description:
      'Mode du guichet : active (sert des clients) ou consultation_only (lecture seule)',
  })
  @IsIn(['active', 'consultation_only'])
  @IsOptional()
  mode?: 'active' | 'consultation_only';

  @ApiPropertyOptional({
    default: false,
    description:
      'Prendre la main sur un guichet déjà ouvert par un autre opérateur',
  })
  @IsBoolean()
  @IsOptional()
  takeOver?: boolean;
}
