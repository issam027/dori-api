import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
  IsIn,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'amel.b' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiPropertyOptional({ example: 'amel.b@dori.tn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ minLength: 10, example: 'InitialSecret2026!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  password!: string;

  @ApiPropertyOptional({ enum: ['human', 'kiosk'], default: 'human' })
  @IsOptional()
  @IsIn(['human', 'kiosk'])
  userType?: string;

  @ApiProperty({ example: 'hotesse', description: 'Rôle initial attribué' })
  @IsString()
  @IsNotEmpty()
  roleName!: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  languagePreference?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  languagePreference?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 10, example: 'NewPassSecure2026!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  newPassword!: string;
}

export class AssignRoleDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @IsNotEmpty()
  roleId!: number;
}
