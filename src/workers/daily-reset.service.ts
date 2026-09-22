import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { ClockService } from '../core/clock/clock.service';
import { resolveQueueConfig } from '../modules/queues/queue-config.helper';

@Injectable()
export class DailyResetService {
  private readonly logger = new Logger(DailyResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Exécute la clôture quotidienne d'une file d'attente (§4.8)
   */
  async resetQueue(queueId: number) {
    const queue = await this.prisma.queue.findUnique({
      where: { queueId },
      include: { site: true },
    });
    if (!queue) return;

    const config = resolveQueueConfig(queue, queue.site);
    const now = this.clockService.now();
    const siteTimezone = queue.site.timezone;
    const currentBusinessDateStr = this.clockService.getBusinessDate(siteTimezone, now);
    const currentBusinessDate = new Date(currentBusinessDateStr);

    this.logger.log(`Exécution de la clôture quotidienne pour la file ${queue.queueCode} (id=${queueId})`);

    await this.prisma.$transaction(async (tx) => {
      // 1. Fermeture des sessions de guichet restées ouvertes
      await tx.queueSession.updateMany({
        where: {
          queueId,
          disconnectedAt: null,
        },
        data: {
          disconnectedAt: now,
          closureReason: 'daily_reset',
        },
      });

      // 2. Traitement des clients encore en attente (status = 'waiting')
      const waitingCustomers = await tx.customer.findMany({
        where: {
          queueId,
          businessDate: currentBusinessDate,
          status: 'waiting',
          isActive: true,
        },
      });

      const carryOver = config.carryOverWaiting.value;

      for (const c of waitingCustomers) {
        // Règle §4.8 : Un ticket reporté ne peut l'être qu'une seule fois
        const alreadyCarriedOver = c.ticketNumber.startsWith('OLD-') || c.carriedOverFromDate !== null;

        if (!carryOver || alreadyCarriedOver) {
          // Expiration terminale
          await tx.customer.update({
            where: { customerId: c.customerId },
            data: {
              status: 'expired',
              closedAt: now,
              isActive: false,
            },
          });
        } else {
          // Report au lendemain : préfixe OLD-, mise à jour businessDate, priorityReferenceTime conservé
          const nextDay = new Date(currentBusinessDate.getTime() + 24 * 60 * 60 * 1000);
          await tx.customer.update({
            where: { customerId: c.customerId },
            data: {
              ticketNumber: `OLD-${c.ticketNumber}`,
              businessDate: nextDay,
              carriedOverFromDate: currentBusinessDate,
            },
          });
        }
      }

      // 3. Neutralisation des inscriptions terminées selon daily_reset_mode
      const resetMode = config.dailyResetMode.value; // 'close_all' | 'close_served_only'
      const statusToClose = resetMode === 'close_all' ? ['served', 'no_show', 'expired'] : ['served'];

      await tx.customer.updateMany({
        where: {
          queueId,
          businessDate: currentBusinessDate,
          status: { in: statusToClose },
          isActive: true,
        },
        data: {
          isActive: false,
          deletedAt: now,
        },
      });

      // 4. Rattrapage des RDV restés booked hors tolérance
      await tx.customer.updateMany({
        where: {
          queueId,
          businessDate: currentBusinessDate,
          entryType: 'appointment',
          appointmentStatus: 'booked',
          isActive: true,
        },
        data: {
          appointmentStatus: 'expired',
          status: 'expired',
          closedAt: now,
          isActive: false,
        },
      });

      // 5. Remise à zéro du compteur de tickets pour la prochaine journée (dori_queue_counter)
      // La prochaine journée démarrera à zéro (au numéro 1 à la première écriture)
    });

    this.logger.log(`Clôture quotidienne terminée avec succès pour la file ${queue.queueCode}`);
  }
}
