import { IsInt, IsOptional, IsIn, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenSessionDto {
  @ApiPropertyOptional({ example: 2, description: 'Numéro de guichet demandé (1..threadCount)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  threadNumber?: number;

  @ApiPropertyOptional({ enum: ['active', 'consultation_only'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'consultation_only'])
  mode: string = 'active';

  @ApiPropertyOptional({ default: false, description: 'true pour forcer la reprise du guichet occupé (§6.2)' })
  @IsOptional()
  @IsBoolean()
  takeOver: boolean = false;
}
