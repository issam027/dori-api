import {
  IsUUID,
  isUUID,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsLocale,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';
import { Transform } from 'class-transformer';
import { strictBoolean } from '../../../core/validation/strict-boolean.transformer';

function IsSiteIdsCsv(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isSiteIdsCsv',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: 'siteIds must be a comma-separated list of UUIDs',
      },
      validator: {
        validate: (value: unknown, _args: ValidationArguments) =>
          typeof value === 'string' &&
          value.length > 0 &&
          value
            .split(',')
            .map((item) => item.trim())
            .every((item) => isUUID(item)),
      },
    });
}

export class CreateUserDto {
  @ApiProperty({
    example: 'operator_tunis',
    description: "Nom d'utilisateur unique",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @ApiPropertyOptional({
    example: 'Jean Dupont',
    description: "Nom complet de l'utilisateur",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'operator@hopital.tn',
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
  @IsUUID()
  @IsOptional()
  roleId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @IsOptional()
  fullName?: string;

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

  @ApiPropertyOptional({ description: 'Activer ou désactiver le compte' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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
  @IsUUID()
  roleId: string;
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
  @ApiPropertyOptional({ type: Boolean, default: true })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '1,3',
    description:
      'Filtrer par sites (affectation directe ou via une file). Format accepté : siteIds=1,2.',
  })
  @IsString()
  @IsSiteIdsCsv()
  @IsOptional()
  siteIds?: string;

  @ApiPropertyOptional({
    enum: ['human', 'kiosk'],
    description: 'Filtrer par type de compte',
  })
  @IsIn(['human', 'kiosk'])
  @IsOptional()
  userType?: 'human' | 'kiosk';

  @ApiPropertyOptional({
    description: 'Recherche libre (nom, username, email)',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
