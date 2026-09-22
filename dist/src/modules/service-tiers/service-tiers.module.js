"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceTiersModule = void 0;
const common_1 = require("@nestjs/common");
const service_tiers_service_1 = require("./service-tiers.service");
const service_tiers_controller_1 = require("./service-tiers.controller");
const clock_service_1 = require("../../core/clock/clock.service");
let ServiceTiersModule = class ServiceTiersModule {
};
exports.ServiceTiersModule = ServiceTiersModule;
exports.ServiceTiersModule = ServiceTiersModule = __decorate([
    (0, common_1.Module)({
        controllers: [service_tiers_controller_1.ServiceTiersController],
        providers: [service_tiers_service_1.ServiceTiersService, clock_service_1.ClockService],
        exports: [service_tiers_service_1.ServiceTiersService],
    })
], ServiceTiersModule);
//# sourceMappingURL=service-tiers.module.js.map