import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { NotificationWorkerService } from './notification-worker.service';
import { AppointmentExpiryService } from './appointment-expiry.service';

async function bootstrap() {
  const logger = new Logger('WorkerRunner');
  const app = await NestFactory.createApplicationContext(AppModule);

  const notifService = app.get(NotificationWorkerService);
  const expiryService = app.get(AppointmentExpiryService);

  logger.log('Workers DORI démarrés (Notification & Expiry)');

  // Boucle de consommation des notifications (toutes les 5 secondes)
  setInterval(async () => {
    try {
      await notifService.processPendingNotifications();
    } catch (e) {
      logger.error('Erreur worker notifications:', e);
    }
  }, 5000);

  // Boucle d'expiration des RDV (toutes les 60 secondes)
  setInterval(async () => {
    try {
      await expiryService.expireAppointments();
    } catch (e) {
      logger.error('Erreur worker expiration RDV:', e);
    }
  }, 60000);
}

bootstrap();
