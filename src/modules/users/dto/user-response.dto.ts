import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserListItemDto {
  @ApiProperty({ example: 1, description: "ID unique de l'utilisateur" })
  user_id: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({ example: 'jdupont@example.com', description: 'Adresse email' })
  email?: string;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'], description: 'Type de compte' })
  user_type: string;

  @ApiProperty({ example: true, description: 'Statut actif du compte' })
  is_active: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  language_preference: string;

  @ApiPropertyOptional({ example: '2026-09-29T10:00:00.000Z', description: 'Dernière connexion' })
  last_login?: string;

  @ApiProperty({ example: '2026-09-01T08:00:00.000Z', description: 'Date de création' })
  created_at: string;

  @ApiProperty({ example: '2026-09-28T14:30:00.000Z', description: 'Date de dernière modification' })
  updated_at: string;
}

export class PaginatedUserResponseDto {
  @ApiProperty({ type: [UserListItemDto], description: 'Liste des utilisateurs' })
  items: UserListItemDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Nombre total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Nombre total de pages' })
  totalPages: number;
}

export class UserRoleItemDto {
  @ApiProperty({ example: 2, description: 'ID du rôle' })
  role_id: number;

  @ApiProperty({ example: 'manager', description: 'Nom de code du rôle' })
  role_name: string;

  @ApiProperty({ example: 3, description: 'Rang hiérarchique du rôle' })
  rank: number;

  @ApiPropertyOptional({ example: 'Gestionnaire de site', description: 'Description du rôle' })
  description?: string;
}

export class UserSiteItemDto {
  @ApiProperty({ example: 1, description: 'ID du site' })
  site_id: number;

  @ApiProperty({ example: 'Site Principal', description: 'Nom du site' })
  site_name: string;

  @ApiProperty({ example: 'public', description: 'Type de site' })
  site_type: string;
}

export class UserQueueItemDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queue_id: number;

  @ApiProperty({ example: 'CARDIO-01', description: 'Code de la file' })
  queue_code: string;

  @ApiProperty({ example: 'Cardiologie', description: 'Nom de la file' })
  queue_name: string;

  @ApiProperty({ example: 1, description: 'ID du site associé' })
  site_id: number;
}

export class UserDetailResponseDto {
  @ApiProperty({ example: 1, description: "ID unique de l'utilisateur" })
  user_id: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({ example: 'jdupont@example.com', description: 'Adresse email' })
  email?: string;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'], description: 'Type de compte' })
  user_type: string;

  @ApiProperty({ example: true, description: 'Statut actif du compte' })
  is_active: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  language_preference: string;

  @ApiPropertyOptional({ example: '2026-09-29T10:00:00.000Z', description: 'Dernière connexion' })
  last_login?: string;

  @ApiProperty({ example: '2026-09-01T08:00:00.000Z', description: 'Date de création' })
  created_at: string;

  @ApiProperty({ example: '2026-09-28T14:30:00.000Z', description: 'Date de dernière modification' })
  updated_at: string;

  @ApiProperty({ type: [UserRoleItemDto], description: 'Rôles attribués' })
  roles: UserRoleItemDto[];

  @ApiProperty({ type: [UserSiteItemDto], description: 'Sites rattachés' })
  sites: UserSiteItemDto[];

  @ApiProperty({ type: [UserQueueItemDto], description: 'Files affectées' })
  queues: UserQueueItemDto[];
}

export class CreateUserResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur créé" })
  user_id: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({ example: 'jdupont@example.com', description: 'Adresse email' })
  email?: string;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'], description: 'Type de compte' })
  user_type: string;

  @ApiProperty({ example: true, description: 'Statut actif' })
  is_active: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  language_preference: string;

  @ApiProperty({ example: '2026-09-29T10:00:00.000Z', description: 'Date de création' })
  created_at: string;
}

export class UpdateUserResponseDto {
  @ApiProperty({ example: 1, description: "ID de l'utilisateur mis à jour" })
  user_id: number;

  @ApiProperty({ example: 'jdupont', description: "Nom d'utilisateur" })
  username: string;

  @ApiPropertyOptional({ example: 'jdupont@example.com', description: 'Adresse email' })
  email?: string;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'], description: 'Type de compte' })
  user_type: string;

  @ApiProperty({ example: true, description: 'Statut actif' })
  is_active: boolean;

  @ApiProperty({ example: 'fr', description: 'Préférence linguistique' })
  language_preference: string;

  @ApiProperty({ example: '2026-09-29T10:00:00.000Z', description: 'Date de mise à jour' })
  updated_at: string;
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

  @ApiProperty({ example: true, description: 'Indique si le mot de passe a été mis à jour' })
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
  role_id: number;

  @ApiProperty({ example: 'manager', description: 'Nom de code du rôle' })
  role_name: string;

  @ApiProperty({ example: 3, description: 'Rang hiérarchique' })
  rank: number;

  @ApiPropertyOptional({ example: 'Gestionnaire de site', description: 'Description du rôle' })
  description?: string;

  @ApiProperty({ example: true, description: 'Statut actif du rôle' })
  is_active: boolean;

  @ApiProperty({
    example: ['user_manage_kiosk', 'user_manage_hostess', 'queue_view'],
    type: [String],
    description: 'Permissions attribuées',
  })
  permissions: string[];

  @ApiPropertyOptional({ example: '2026-09-01T08:00:00.000Z', description: 'Date de création' })
  created_at?: string;

  @ApiPropertyOptional({ example: '2026-09-28T14:30:00.000Z', description: 'Date de dernière modification' })
  updated_at?: string;
}

export class PaginatedRoleResponseDto {
  @ApiProperty({ type: [RoleDetailResponseDto], description: 'Liste des rôles' })
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

  @ApiProperty({ example: true, description: 'Confirmation de la mise à jour des permissions' })
  permissionsUpdated: boolean;
}
