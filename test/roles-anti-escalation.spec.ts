import { canManageRole, ROLE_RANKS, RoleName } from '../src/core/rbac/roles.enum';

describe('Rôles et règle anti-escalade (§4.9)', () => {
  it('respecte la hiérarchie stricte des rangs (kiosk:1 < hotesse:2 < manager:3 < admin:4 < root:5)', () => {
    expect(ROLE_RANKS[RoleName.KIOSK]).toBe(1);
    expect(ROLE_RANKS[RoleName.HOTESSE]).toBe(2);
    expect(ROLE_RANKS[RoleName.MANAGER]).toBe(3);
    expect(ROLE_RANKS[RoleName.ADMIN]).toBe(4);
    expect(ROLE_RANKS[RoleName.ROOT]).toBe(5);
  });

  it('interdit la gestion d\'un compte de rang supérieur ou égal (sauf root)', () => {
    // Un manager (rank 3) ne peut pas gérer un manager (rank 3)
    expect(canManageRole(ROLE_RANKS[RoleName.MANAGER], ROLE_RANKS[RoleName.MANAGER], false)).toBe(false);

    // Un manager (rank 3) ne peut pas gérer un admin (rank 4)
    expect(canManageRole(ROLE_RANKS[RoleName.MANAGER], ROLE_RANKS[RoleName.ADMIN], false)).toBe(false);

    // Un manager (rank 3) PEUT gérer une hôtesse (rank 2) et un kiosk (rank 1)
    expect(canManageRole(ROLE_RANKS[RoleName.MANAGER], ROLE_RANKS[RoleName.HOTESSE], false)).toBe(true);
    expect(canManageRole(ROLE_RANKS[RoleName.MANAGER], ROLE_RANKS[RoleName.KIOSK], false)).toBe(true);

    // Root peut tout gérer, y compris les comptes root
    expect(canManageRole(ROLE_RANKS[RoleName.ROOT], ROLE_RANKS[RoleName.ROOT], true)).toBe(true);
  });
});
