"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClockService = void 0;
const common_1 = require("@nestjs/common");
const date_fns_tz_1 = require("date-fns-tz");
let ClockService = class ClockService {
    now() {
        return new Date();
    }
    getBusinessDate(timezone = 'Africa/Tunis', date = this.now()) {
        const zoned = (0, date_fns_tz_1.toZonedTime)(date, timezone);
        return (0, date_fns_tz_1.format)(zoned, 'yyyy-MM-dd', { timeZone: timezone });
    }
    getEndOfBusinessDay(timezone = 'Africa/Tunis', date = this.now()) {
        const dateStr = this.getBusinessDate(timezone, date);
        const endOfDayStr = `${dateStr}T23:59:59.999`;
        return new Date(`${endOfDayStr}Z`);
    }
    diffInMinutes(dateA, dateB) {
        return Math.max(0, Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60)));
    }
};
exports.ClockService = ClockService;
exports.ClockService = ClockService = __decorate([
    (0, common_1.Injectable)()
], ClockService);
//# sourceMappingURL=clock.service.js.map