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
  username: string;

  @ApiPropertyOptional({
    example: 'hostesse@hopital.tn',
    description: 'Adresse e-mail',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'Secure@Pass2026',
    description: 'Mot de passe (minimum 10 caractères)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
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
  @IsOptional()
  roleId?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'nouvel.email@hopital.tn' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'ar' })
  @IsString()
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
    example: 'NewSecure@2026',
    description: 'Nouveau mot de passe (minimum 10 caractères)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  newPassword: string;
}

export class AssignUserRoleDto {
  @ApiProperty({ example: 2, description: 'ID du rôle à assigner' })
  @IsInt()
  roleId: number;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['site_view', 'queue_view', 'customer_register'],
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
