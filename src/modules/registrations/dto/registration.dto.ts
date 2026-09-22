import {
  IsInt,
  IsString,
  IsOptional,
  IsIn,
  ValidateNested,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePersonDto } from '../../persons/dto/person.dto';

export class CreateRegistrationDto {
  @ApiPropertyOptional({ description: 'ID de la personne si déjà existante' })
  @IsOptional()
  @IsInt()
  personId?: number;

  @ApiPropertyOptional({ description: 'Création à la volée de la personne' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePersonDto)
  person?: CreatePersonDto;

  @ApiProperty({ example: 45 })
  @IsInt()
  @IsNotEmpty()
  queueId!: number;

  @ApiProperty({ example: 1, description: 'Forfait de service obligatoire (défaut: free)' })
  @IsInt()
  @IsNotEmpty()
  tierId!: number;

  @ApiProperty({ enum: ['walkin', 'appointment'], default: 'walkin' })
  @IsIn(['walkin', 'appointment'])
  entryType: string = 'walkin';

  @ApiPropertyOptional({ example: '2026-09-20T11:00:00+01:00' })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-09-21T09:30:00+01:00' })
  @IsDateString()
  @IsNotEmpty()
  scheduledTime!: string;
}

export class UpdateRegistrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  languagePreference?: string;
}
