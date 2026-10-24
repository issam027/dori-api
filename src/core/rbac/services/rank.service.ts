import { Injectable } from '@nestjs/common';

export const ROLE_RANK = {
  kiosk: 1,
  operator: 2,
  manager: 3,
  admin: 4,
  root: 5,
} as const;

@Injectable()
export class RankService {
  callerRank(roles: string[] | undefined, persistedRank: number): number {
    return roles?.includes('root') ? ROLE_RANK.root : persistedRank;
  }

  userRank(persistedRank: number, userType?: string): number {
    if (persistedRank > 0) return persistedRank;
    return userType === 'kiosk' ? ROLE_RANK.kiosk : 0;
  }

  maximumManageableRank(
    callerRank: number,
    roles: string[] | undefined,
    permissionRank: number,
  ): number {
    let maximum: number =
      callerRank >= ROLE_RANK.admin || roles?.includes('admin')
        ? ROLE_RANK.manager
        : ROLE_RANK.operator;
    if (permissionRank > 0) maximum = Math.min(maximum, permissionRank);
    return maximum;
  }

  canActOn(callerRank: number, targetRank: number): boolean {
    return targetRank < callerRank;
  }
}
