import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSummaryResponseDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 'agent_med' })
  username!: string;

  @ApiPropertyOptional({ example: 'agent@dori.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'] })
  userType!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'fr' })
  languagePreference!: string;

  @ApiPropertyOptional({ example: '2026-09-20T08:00:00.000Z', nullable: true })
  lastLogin?: Date | null;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: ['operator'], isArray: true })
  roles!: string[];
}

export class UserAssignedSiteDto {
  @ApiProperty({ example: 1 })
  siteId!: number;

  @ApiProperty({ example: 'Clinique Pasteur' })
  siteName!: string;
}

export class UserAssignedQueueDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 'MED-01' })
  queueCode!: string;

  @ApiPropertyOptional({ example: 'Médecine Générale', nullable: true })
  queueName?: string | null;
}

export class UserDetailResponseDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 'agent_med' })
  username!: string;

  @ApiPropertyOptional({ example: 'agent@dori.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'] })
  userType!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'fr' })
  languagePreference!: string;

  @ApiPropertyOptional({ example: '2026-09-20T08:00:00.000Z', nullable: true })
  lastLogin?: Date | null;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: ['operator'], isArray: true })
  roles!: string[];

  @ApiProperty({ type: [UserAssignedSiteDto] })
  sites!: UserAssignedSiteDto[];

  @ApiProperty({ type: [UserAssignedQueueDto] })
  queues!: UserAssignedQueueDto[];
}

export class PermissionDto {
  @ApiProperty({ example: 1 })
  permissionId!: number;

  @ApiProperty({ example: 'queue_view' })
  permissionName!: string;

  @ApiPropertyOptional({ example: 'Visualiser les files', nullable: true })
  description?: string | null;
}

export class RolePermissionItemDto {
  @ApiProperty({ type: PermissionDto })
  permission!: PermissionDto;
}

export class RoleResponseDto {
  @ApiProperty({ example: 1 })
  roleId!: number;

  @ApiProperty({ example: 'operator' })
  roleName!: string;

  @ApiProperty({ example: 20, description: 'Rang hiérarchique anti-escalade' })
  rank!: number;

  @ApiPropertyOptional({ example: 'Opérateur de guichet physique', nullable: true })
  description?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: [RolePermissionItemDto] })
  rolePermissions!: RolePermissionItemDto[];
}

export class RoleAssignmentResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 3 })
  roleId!: number;

  @ApiProperty({ example: 'operator' })
  roleName!: string;
}
