import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { ClockService } from '../core/clock/clock.service';

@Injectable()
export class NotificationWorkerService {
  private readonly logger = new Logger(NotificationWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Traitement en lot des notifications en attente (SMS / Email)
   */
  async processPendingNotifications() {
    const pendingNotifications = await this.prisma.notification.findMany({
      where: {
        notificationStatus: 'pending',
      },
      take: 20,
    });

    for (const notif of pendingNotifications) {
      try {
        const now = this.clockService.now();

        // Envoi simulé ou appel adaptateur fournisseur (§4.13)
        this.logger.log(
          `Envoi notification [${notif.channel.toUpperCase()}] à ${notif.recipient}: ${notif.notificationContent}`,
        );

        // Simulation de provider_message_id
        const providerMessageId = `prov_${Date.now()}_${notif.notificationId}`;

        await this.prisma.notification.update({
          where: { notificationId: notif.notificationId },
          data: {
            notificationStatus: 'sent',
            sentAt: now,
            providerMessageId,
            attemptCount: { increment: 1 },
          },
        });
      } catch (err: any) {
        this.logger.error(`Échec envoi notification id=${notif.notificationId}:`, err);
        await this.prisma.notification.update({
          where: { notificationId: notif.notificationId },
          data: {
            attemptCount: { increment: 1 },
            failureReason: err?.message || 'Erreur inconnue',
            notificationStatus: notif.attemptCount >= 3 ? 'failed' : 'pending',
          },
        });
      }
    }
  }
}
