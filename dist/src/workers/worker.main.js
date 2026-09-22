"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("../app.module");
const notification_worker_service_1 = require("./notification-worker.service");
const appointment_expiry_service_1 = require("./appointment-expiry.service");
async function bootstrap() {
    const logger = new common_1.Logger('WorkerRunner');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const notifService = app.get(notification_worker_service_1.NotificationWorkerService);
    const expiryService = app.get(appointment_expiry_service_1.AppointmentExpiryService);
    logger.log('🚀 Workers DORI-TN V3 démarrés (Notification & Expiry)');
    setInterval(async () => {
        try {
            await notifService.processPendingNotifications();
        }
        catch (e) {
            logger.error('Erreur worker notifications:', e);
        }
    }, 5000);
    setInterval(async () => {
        try {
            await expiryService.expireAppointments();
        }
        catch (e) {
            logger.error('Erreur worker expiration RDV:', e);
        }
    }, 60000);
}
bootstrap();
//# sourceMappingURL=worker.main.js.map