import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidSessionMode } from '../../../core/validation/domain-validation.decorators';
import { Transform } from 'class-transformer';

@ValidSessionMode()
export class OpenQueueSessionDto {
  @ApiPropertyOptional({
    example: 'Guichet 04',
    maxLength: 100,
    description:
      'Nom complet et libre du point de service, par exemple Bureau A, Guichet 04 ou Cabinet 2',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  counterName?: string;

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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Session occupant le thread que le frontend confirme vouloir remplacer. La disponibilité est revérifiée transactionnellement.',
  })
  @IsUUID('4')
  @IsOptional()
  replaceSessionId?: string;
}
