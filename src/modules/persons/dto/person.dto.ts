import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonDto {
  @ApiPropertyOptional({ example: 'Amina' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Trabelsi' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'amina.trabelsi@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+21650123456',
    description: 'Format E.164 avec le signe + obligatoire (§3.4)',
  })
  @IsOptional()
  @Matches(/^\+[1-9][0-9]{6,14}$/, {
    message: 'Le numéro de téléphone doit respecter le format E.164 (ex: +21650123456)',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  languagePreference?: string;
}

export class UpdatePersonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+[1-9][0-9]{6,14}$/)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  languagePreference?: string;
}

export class CreatePersonNoteDto {
  @ApiProperty({ example: 'Allergique aux fraises, se déplace en fauteuil roulant' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdatePersonNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;
}
