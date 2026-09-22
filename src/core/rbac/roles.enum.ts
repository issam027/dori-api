export enum RoleName {
  KIOSK = 'kiosk',
  HOTESSE = 'hotesse',
  MANAGER = 'manager',
  ADMIN = 'admin',
  ROOT = 'root',
}

export const ROLE_RANKS: Record<string, number> = {
  [RoleName.KIOSK]: 1,
  [RoleName.HOTESSE]: 2,
  [RoleName.MANAGER]: 3,
  [RoleName.ADMIN]: 4,
  [RoleName.ROOT]: 5,
};

/**
 * Vérifie si le rôle source a un rang strictement supérieur au rôle cible (§4.9 - anti-escalade)
 */
export function canManageRole(sourceRoleRank: number, targetRoleRank: number, isRoot: boolean): boolean {
  if (isRoot) return true;
  return sourceRoleRank > targetRoleRank;
}
