import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class UserSummaryDto {
  @ApiProperty({ example: 1, description: "ID unique de l'utilisateur" })
  userId: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({
    example: 'jdupont@example.com',
    description: 'Adresse email',
  })
  email?: string;

  @ApiProperty({
    example: 'human',
    enum: ['human', 'kiosk'],
    description: 'Type de compte',
  })
  userType: string;

  @ApiProperty({ example: true, description: 'Statut actif du compte' })
  isActive: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  languagePreference: string;

  @ApiPropertyOptional({
    example: '2026-09-29T10:00:00.000Z',
    description: 'Dernière connexion',
  })
  lastLogin?: string;

  @ApiProperty({
    example: '2026-09-01T08:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-28T14:30:00.000Z',
    description: 'Date de dernière modification',
  })
  updatedAt: string;
}

export class PaginatedUserResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [UserSummaryDto],
    description: 'Liste des utilisateurs',
  })
  items: UserSummaryDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Nombre total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Nombre total de pages' })
  totalPages: number;
}

export class UserRoleDetailDto {
  @ApiProperty({ example: 2, description: 'ID du rôle' })
  roleId: number;

  @ApiProperty({ example: 'manager', description: 'Nom de code du rôle' })
  roleName: string;

  @ApiProperty({ example: 3, description: 'Rang hiérarchique du rôle' })
  rank: number;

  @ApiPropertyOptional({
    example: 'Gestionnaire de site',
    description: 'Description du rôle',
  })
  description?: string;
}

export class UserSiteDetailDto {
  @ApiProperty({ example: 1, description: 'ID du site' })
  siteId: number;

  @ApiProperty({ example: 'Site Principal', description: 'Nom du site' })
  siteName: string;

  @ApiProperty({ example: 'public', description: 'Type de site' })
  siteType: string;
}

export class UserQueueDetailDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 'CARDIO-01', description: 'Code de la file' })
  queueCode: string;

  @ApiProperty({ example: 'Cardiologie', description: 'Nom de la file' })
  queueName: string;

  @ApiProperty({ example: 1, description: 'ID du site associé' })
  siteId: number;
}

export class UserDetailResponseDto {
  @ApiProperty({ example: 1, description: "ID unique de l'utilisateur" })
  userId: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({
    example: 'jdupont@example.com',
    description: 'Adresse email',
  })
  email?: string;

  @ApiProperty({
    example: 'human',
    enum: ['human', 'kiosk'],
    description: 'Type de compte',
  })
  userType: string;

  @ApiProperty({ example: true, description: 'Statut actif du compte' })
  isActive: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  languagePreference: string;

  @ApiPropertyOptional({
    example: '2026-09-29T10:00:00.000Z',
    description: 'Dernière connexion',
  })
  lastLogin?: string;

  @ApiProperty({
    example: '2026-09-01T08:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-28T14:30:00.000Z',
    description: 'Date de dernière modification',
  })
  updatedAt: string;

  @ApiProperty({ type: [UserRoleDetailDto], description: 'Rôles attribués' })
  roles: UserRoleDetailDto[];

  @ApiProperty({ type: [UserSiteDetailDto], description: 'Sites rattachés' })
  sites: UserSiteDetailDto[];

  @ApiProperty({ type: [UserQueueDetailDto], description: 'Files affectées' })
  queues: UserQueueDetailDto[];
}

export class CreateUserResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur créé" })
  userId: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({
    example: 'jdupont@example.com',
    description: 'Adresse email',
  })
  email?: string;

  @ApiProperty({
    example: 'human',
    enum: ['human', 'kiosk'],
    description: 'Type de compte',
  })
  userType: string;

  @ApiProperty({ example: true, description: 'Statut actif' })
  isActive: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  languagePreference: string;

  @ApiProperty({
    example: '2026-09-29T10:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;
}

export class UpdateUserResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur mis à jour" })
  userId: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({
    example: 'jdupont@example.com',
    description: 'Adresse email',
  })
  email?: string;

  @ApiProperty({
    example: 'human',
    enum: ['human', 'kiosk'],
    description: 'Type de compte',
  })
  userType: string;

  @ApiProperty({ example: true, description: 'Statut actif' })
  isActive: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  languagePreference: string;

  @ApiProperty({
    example: '2026-09-29T10:00:00.000Z',
    description: 'Date de mise à jour',
  })
  updatedAt: string;
}

export class UpdateUserStatusResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur" })
  userId: number;

  @ApiProperty({ example: false, description: 'Nouveau statut actif' })
  isActive: boolean;
}

export class SetUserPasswordResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur" })
  userId: number;

  @ApiProperty({
    example: true,
    description: 'Indique si le mot de passe a été mis à jour',
  })
  passwordUpdated: boolean;
}

export class AssignUserRoleResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur" })
  userId: number;

  @ApiProperty({ example: 2, description: 'ID du rôle assigné' })
  roleId: number;

  @ApiProperty({ example: true, description: "Confirmation de l'assignation" })
  assigned: boolean;
}

export class RemoveUserRoleResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur" })
  userId: number;

  @ApiProperty({ example: 2, description: 'ID du rôle retiré' })
  roleId: number;

  @ApiProperty({ example: true, description: 'Confirmation du retrait' })
  removed: boolean;
}

export class RoleDetailResponseDto {
  @ApiProperty({ example: 1, description: 'ID unique du rôle' })
  roleId: number;

  @ApiProperty({ example: 'manager', description: 'Nom de code du rôle' })
  roleName: string;

  @ApiProperty({ example: 3, description: 'Rang hiérarchique' })
  rank: number;

  @ApiPropertyOptional({
    example: 'Gestionnaire de site',
    description: 'Description du rôle',
  })
  description?: string;

  @ApiProperty({ example: true, description: 'Statut actif du rôle' })
  isActive: boolean;

  @ApiProperty({
    example: ['user_manage_kiosk', 'user_manage_hostess', 'queue_view'],
    type: [String],
    description: 'Permissions attribuées',
  })
  permissions: string[];

  @ApiPropertyOptional({
    example: '2026-09-01T08:00:00.000Z',
    description: 'Date de création',
  })
  createdAt?: string;

  @ApiPropertyOptional({
    example: '2026-09-28T14:30:00.000Z',
    description: 'Date de dernière modification',
  })
  updatedAt?: string;
}

export class PaginatedRoleResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [RoleDetailResponseDto],
    description: 'Liste des rôles',
  })
  items: RoleDetailResponseDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 5, description: "Nombre total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Nombre total de pages' })
  totalPages: number;
}

export class UpdateRolePermissionsResponseDto {
  @ApiProperty({ example: 1, description: 'ID du rôle mis à jour' })
  roleId: number;

  @ApiProperty({
    example: true,
    description: 'Confirmation de la mise à jour des permissions',
  })
  permissionsUpdated: boolean;
}

export class UserDeleteResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur supprimé" })
  userId: number;

  @ApiProperty({ example: true, description: 'Confirmation de la suppression' })
  deleted: boolean;
}
