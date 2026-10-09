import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 1, description: "ID unique de l'utilisateur" })
  userId: number;

  @ApiProperty({ example: 'admin', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({
    example: 'admin@dori.local',
    description: 'Adresse email',
  })
  email?: string;

  @ApiProperty({
    example: 'human',
    enum: ['human', 'kiosk'],
    description: 'Type de compte',
  })
  userType: string;

  @ApiProperty({
    example: ['admin'],
    type: [String],
    description: 'Rôles attribués',
  })
  roles: string[];

  @ApiProperty({
    example: ['site_view', 'queue_view', 'session_operate'],
    type: [String],
    description: 'Permissions effectives',
  })
  permissions: string[];

  @ApiProperty({
    example: false,
    description: 'Changement de mot de passe obligatoire',
  })
  mustChangePassword: boolean;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: "Jeton JWT d'accès Bearer",
  })
  accessToken: string;

  @ApiProperty({
    example: '49c36121-3645-47d0-915d-1070e842de0f-...',
    description: 'Jeton de rafraîchissement (rotation)',
  })
  refreshToken: string;

  @ApiProperty({
    type: AuthUserDto,
    description: "Profil de l'utilisateur connecté",
  })
  user: AuthUserDto;
}

export class TokensResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: "Nouveau jeton JWT d'accès",
  })
  accessToken: string;

  @ApiProperty({
    example: 'f87a8b9e-64d5-412e-9d2a-89a01cfba982-...',
    description: 'Nouveau jeton de rafraîchissement',
  })
  refreshToken: string;

  @ApiProperty({
    type: AuthUserDto,
    description: 'Profil associé aux tokens renouvelés',
  })
  user: AuthUserDto;
}

export class UserScopeDto {
  @ApiProperty({ example: false })
  isGlobal: boolean;

  @ApiProperty({ type: [Number], example: [1] })
  siteIds: number[];

  @ApiProperty({ type: [Number], example: [1, 2] })
  queueIds: number[];
}

export class CurrentUserResponseDto extends AuthUserDto {
  @ApiPropertyOptional({ example: 'fr' })
  languagePreference?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastLogin?: string | null;

  @ApiProperty({ type: UserScopeDto })
  scope: UserScopeDto;
}

export class SimpleMessageResponseDto {
  @ApiProperty({
    example: true,
    description: 'Opération effectuée avec succès',
  })
  success: boolean;
}
