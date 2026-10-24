import { RankService, ROLE_RANK } from './rank.service';

describe('RankService', () => {
  const service = new RankService();

  it('gives root the named root rank', () => {
    expect(service.callerRank(['root'], 0)).toBe(ROLE_RANK.root);
  });

  it('uses the kiosk fallback only when no persisted role exists', () => {
    expect(service.userRank(0, 'kiosk')).toBe(ROLE_RANK.kiosk);
    expect(service.userRank(ROLE_RANK.operator, 'kiosk')).toBe(
      ROLE_RANK.operator,
    );
  });

  it('caps the manageable rank with the permission rank', () => {
    expect(
      service.maximumManageableRank(
        ROLE_RANK.admin,
        ['admin'],
        ROLE_RANK.operator,
      ),
    ).toBe(ROLE_RANK.operator);
  });

  it('only allows actions on a strictly lower rank', () => {
    expect(service.canActOn(ROLE_RANK.manager, ROLE_RANK.operator)).toBe(true);
    expect(service.canActOn(ROLE_RANK.manager, ROLE_RANK.manager)).toBe(false);
  });
});
