"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkersModule = void 0;
const common_1 = require("@nestjs/common");
const daily_reset_service_1 = require("./daily-reset.service");
const appointment_expiry_service_1 = require("./appointment-expiry.service");
const notification_worker_service_1 = require("./notification-worker.service");
const clock_service_1 = require("../core/clock/clock.service");
let WorkersModule = class WorkersModule {
};
exports.WorkersModule = WorkersModule;
exports.WorkersModule = WorkersModule = __decorate([
    (0, common_1.Module)({
        providers: [
            daily_reset_service_1.DailyResetService,
            appointment_expiry_service_1.AppointmentExpiryService,
            notification_worker_service_1.NotificationWorkerService,
            clock_service_1.ClockService,
        ],
        exports: [
            daily_reset_service_1.DailyResetService,
            appointment_expiry_service_1.AppointmentExpiryService,
            notification_worker_service_1.NotificationWorkerService,
        ],
    })
], WorkersModule);
//# sourceMappingURL=workers.module.js.map