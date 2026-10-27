import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CockpitQueryDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Files à rafraîchir. Accepte une liste CSV ou plusieurs paramètres queueIds.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const values = Array.isArray(value) ? value : [value];
    return values
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  queueIds?: string[];

  @ApiPropertyOptional({ type: Number, default: 3, minimum: 0, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  previewLimit: number = 3;

  @ApiPropertyOptional({ type: Number, default: 10, minimum: 0, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  recentLimit: number = 10;
}
