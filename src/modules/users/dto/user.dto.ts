import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Min,
  IsLocale,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class CreateUserDto {
  @ApiProperty({
    example: 'hostesse_tunis',
    description: "Nom d'utilisateur unique",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @ApiPropertyOptional({
    example: 'hostesse@hopital.tn',
    description: 'Adresse e-mail',
  })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '••••••••••••',
    description: 'Mot de passe (entre 10 et 20 caractères)',
    minLength: 10,
    maxLength: 20,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  password: string;

  @ApiPropertyOptional({
    enum: ['human', 'kiosk'],
    default: 'human',
    description: 'Type de compte',
  })
  @IsIn(['human', 'kiosk'])
  @IsOptional()
  userType?: 'human' | 'kiosk';

  @ApiPropertyOptional({
    example: 'fr',
    description: 'Préférence de langue (ISO 639-1)',
  })
  @IsString()
  @IsOptional()
  languagePreference?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Rôle initial à assigner (ID)',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  roleId?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'nouvel.email@hopital.tn' })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'ar' })
  @IsLocale()
  @MaxLength(10)
  @IsOptional()
  languagePreference?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'Activer (true) ou désactiver (false) le compte',
    example: false,
  })
  @IsBoolean()
  isActive: boolean;
}

export class SetUserPasswordDto {
  @ApiProperty({
    example: '••••••••••••',
    description: 'Nouveau mot de passe (entre 10 et 20 caractères)',
    minLength: 10,
    maxLength: 20,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  newPassword: string;
}

export class AssignUserRoleDto {
  @ApiProperty({ example: 2, description: 'ID du rôle à assigner' })
  @IsInt()
  @Min(1)
  roleId: number;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['site_view', 'queue_view', 'registration_register'],
    description: 'Liste complète des noms de permissions à attribuer au rôle',
  })
  @IsArray()
  @IsString({ each: true })
  permissionNames: string[];
}

export class UserFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['human', 'kiosk'],
    description: 'Filtrer par type de compte',
  })
  @IsIn(['human', 'kiosk'])
  @IsOptional()
  userType?: 'human' | 'kiosk';

  @ApiPropertyOptional({ description: 'Recherche libre (username, email)' })
  @IsString()
  @IsOptional()
  search?: string;
}
