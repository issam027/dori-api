import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { ClockService } from '../core/clock/clock.service';
import { resolveQueueConfig } from '../modules/queues/queue-config.helper';

@Injectable()
export class AppointmentExpiryService {
  private readonly logger = new Logger(AppointmentExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Exécute l'expiration des RDV restés booked au-delà de la tolérance (§4.3)
   */
  async expireAppointments() {
    const now = this.clockService.now();

    // Récupérer les RDV en attente
    const pendingAppointments = await this.prisma.customer.findMany({
      where: {
        entryType: 'appointment',
        appointmentStatus: 'booked',
        status: 'waiting',
        isActive: true,
      },
      include: {
        queue: {
          include: { site: true },
        },
      },
    });

    let expiredCount = 0;

    for (const appt of pendingAppointments) {
      if (!appt.scheduledTime) continue;

      const config = resolveQueueConfig(appt.queue, appt.queue.site);
      const lateToleranceMinutes = config.lateToleranceMinutes.value;
      const expirationDeadline = new Date(
        appt.scheduledTime.getTime() + lateToleranceMinutes * 60 * 1000,
      );

      if (now > expirationDeadline) {
        await this.prisma.customer.update({
          where: { customerId: appt.customerId },
          data: {
            appointmentStatus: 'expired',
            status: 'expired',
            closedAt: now,
          },
        });
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Expiration de ${expiredCount} rendez-vous non honorés`);
    }
  }
}
