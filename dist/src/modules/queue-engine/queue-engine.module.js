"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEngineModule = void 0;
const common_1 = require("@nestjs/common");
const queue_engine_service_1 = require("./queue-engine.service");
const queue_engine_controller_1 = require("./queue-engine.controller");
const clock_service_1 = require("../../core/clock/clock.service");
let QueueEngineModule = class QueueEngineModule {
};
exports.QueueEngineModule = QueueEngineModule;
exports.QueueEngineModule = QueueEngineModule = __decorate([
    (0, common_1.Module)({
        controllers: [queue_engine_controller_1.QueueEngineController],
        providers: [queue_engine_service_1.QueueEngineService, clock_service_1.ClockService],
        exports: [queue_engine_service_1.QueueEngineService],
    })
], QueueEngineModule);
//# sourceMappingURL=queue-engine.module.js.map