import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserSummaryDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 'admin' })
  username!: string;

  @ApiPropertyOptional({ example: 'admin@dori.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: ['admin_site'], isArray: true })
  roles!: string[];

  @ApiProperty({ example: ['site_view', 'queue_view'], isArray: true })
  permissions!: string[];

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'] })
  userType!: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'a9f0e1b2c3d4e5f6...' })
  refreshToken!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ type: AuthUserSummaryDto })
  user!: AuthUserSummaryDto;
}

export class RefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'c1d2e3f4a5b6c7d8...' })
  refreshToken!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;
}

export class UserScopeDto {
  @ApiProperty({ example: false, description: 'Accès sans restriction à tous les sites (root)' })
  allSites!: boolean;

  @ApiProperty({ example: [1, 2], isArray: true, description: 'IDs des sites autorisés' })
  allowedSiteIds!: number[];

  @ApiProperty({ example: [1, 2, 3], isArray: true, description: 'IDs des files autorisées' })
  allowedQueueIds!: number[];
}

export class UserMeResponseDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 'admin' })
  username!: string;

  @ApiPropertyOptional({ example: 'admin@dori.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'] })
  userType!: string;

  @ApiProperty({ example: 'fr' })
  languagePreference!: string;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: ['admin_site'], isArray: true })
  roles!: string[];

  @ApiProperty({ example: ['site_view', 'queue_view'], isArray: true })
  permissions!: string[];

  @ApiProperty({ type: UserScopeDto })
  scope!: UserScopeDto;
}

export class ActionSuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
