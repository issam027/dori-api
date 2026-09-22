"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const jwt_auth_guard_1 = require("./core/auth/jwt-auth.guard");
const database_module_1 = require("./core/database/database.module");
const rbac_module_1 = require("./core/rbac/rbac.module");
const realtime_module_1 = require("./core/realtime/realtime.module");
const auth_module_1 = require("./modules/auth/auth.module");
const sites_module_1 = require("./modules/sites/sites.module");
const queues_module_1 = require("./modules/queues/queues.module");
const service_tiers_module_1 = require("./modules/service-tiers/service-tiers.module");
const persons_module_1 = require("./modules/persons/persons.module");
const registrations_module_1 = require("./modules/registrations/registrations.module");
const queue_engine_module_1 = require("./modules/queue-engine/queue-engine.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const translations_module_1 = require("./modules/translations/translations.module");
const users_module_1 = require("./modules/users/users.module");
const reports_module_1 = require("./modules/reports/reports.module");
const health_module_1 = require("./modules/health/health.module");
const workers_module_1 = require("./workers/workers.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            database_module_1.DatabaseModule,
            rbac_module_1.RbacModule,
            realtime_module_1.RealtimeModule,
            auth_module_1.AuthModule,
            sites_module_1.SitesModule,
            queues_module_1.QueuesModule,
            service_tiers_module_1.ServiceTiersModule,
            persons_module_1.PersonsModule,
            registrations_module_1.RegistrationsModule,
            queue_engine_module_1.QueueEngineModule,
            notifications_module_1.NotificationsModule,
            translations_module_1.TranslationsModule,
            users_module_1.UsersModule,
            reports_module_1.ReportsModule,
            health_module_1.HealthModule,
            workers_module_1.WorkersModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map