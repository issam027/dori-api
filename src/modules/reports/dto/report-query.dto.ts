import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
import { DateRangeQueryDto } from '../../../core/dates/date-range.dto';
import { ExactlyOneOf } from '../../../core/validation/domain-validation.decorators';
import { strictBoolean } from '../../../core/validation/strict-boolean.transformer';

function IsQueueIdsCsv(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isQueueIdsCsv',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: 'queueIds must be a comma-separated list of positive integers',
      },
      validator: {
        validate: (value: unknown, _args: ValidationArguments) =>
          typeof value === 'string' &&
          value.length > 0 &&
          value
            .split(',')
            .map((item) => item.trim())
            .every((item) => /^\d+$/.test(item) && Number(item) > 0),
      },
    });
}

@ExactlyOneOf(['queueIds', 'siteId'])
export class ReportSeriesQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    description:
      'Identifiants de files séparés par des virgules. Une seule file utilise par exemple queueIds=10.',
  })
  @IsString()
  @IsQueueIdsCsv()
  @IsOptional()
  queueIds?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  siteId?: number;

  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    default: 'day',
    description: 'Granularité temporelle des buckets retournés',
  })
  @IsIn(['day', 'week', 'month'])
  @IsOptional()
  granularity: 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({
    default: false,
    description:
      'Inclure les périodes sans inscription avec des volumes à zéro et des KPI non calculables à null',
  })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  includeEmpty: boolean = false;

  @ApiPropertyOptional({
    enum: ['site', 'queue', 'tier', 'entryType', 'hour', 'weekday'],
    description: 'Dimension optionnelle de regroupement des résultats',
  })
  @IsIn(['site', 'queue', 'tier', 'entryType', 'hour', 'weekday'])
  @IsOptional()
  groupBy?: 'site' | 'queue' | 'tier' | 'entryType' | 'hour' | 'weekday';
}
