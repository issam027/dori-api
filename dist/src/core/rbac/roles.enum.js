"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_RANKS = exports.RoleName = void 0;
exports.canManageRole = canManageRole;
var RoleName;
(function (RoleName) {
    RoleName["KIOSK"] = "kiosk";
    RoleName["HOTESSE"] = "hotesse";
    RoleName["MANAGER"] = "manager";
    RoleName["ADMIN"] = "admin";
    RoleName["ROOT"] = "root";
})(RoleName || (exports.RoleName = RoleName = {}));
exports.ROLE_RANKS = {
    [RoleName.KIOSK]: 1,
    [RoleName.HOTESSE]: 2,
    [RoleName.MANAGER]: 3,
    [RoleName.ADMIN]: 4,
    [RoleName.ROOT]: 5,
};
function canManageRole(sourceRoleRank, targetRoleRank, isRoot) {
    if (isRoot)
        return true;
    return sourceRoleRank > targetRoleRank;
}
//# sourceMappingURL=roles.enum.js.map