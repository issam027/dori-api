import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTranslationDto {
  @ApiProperty({ example: 'ihm.queue.position_update' })
  @IsString()
  @IsNotEmpty()
  translationKey!: string;

  @ApiProperty({ enum: ['ihm', 'sms', 'error'], default: 'ihm' })
  @IsIn(['ihm', 'sms', 'error'])
  category: string = 'ihm';

  @ApiProperty({ example: 'fr' })
  @IsString()
  @IsNotEmpty()
  locale!: string;

  @ApiProperty({ example: 'Vous êtes en {position}ᵉ position, environ {minutes} min' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ example: ['position', 'minutes'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedParams?: string[];
}

export class UpdateTranslationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedParams?: string[];
}
