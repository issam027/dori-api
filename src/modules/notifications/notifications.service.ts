import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { WebhookNotificationDto } from './dto/notification.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async findAll(
    user: UserContext,
    pagination: PaginationQueryDto,
    registrationId?: number,
    channel?: string,
    status?: string,
  ) {
    const whereClause: any = {};
    if (registrationId) whereClause.customerId = registrationId;
    if (channel) whereClause.channel = channel;
    if (status) whereClause.notificationStatus = status;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          customer: {
            select: {
              ticketNumber: true,
              queueId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: whereClause }),
    ]);

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async findById(user: UserContext, notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { notificationId },
      include: { customer: true },
    });

    if (!notification) {
      throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { notificationId });
    }

    await this.scopeService.validateQueueScope(user, notification.customer.queueId);
    return notification;
  }

  async resend(user: UserContext, notificationId: number) {
    const notification = await this.findById(user, notificationId);

    const updated = await this.prisma.notification.update({
      where: { notificationId },
      data: {
        notificationStatus: 'pending',
        attemptCount: { increment: 1 },
        failureReason: null,
      },
    });

    return updated;
  }

  async handleWebhook(provider: string, dto: WebhookNotificationDto) {
    const notification = await this.prisma.notification.findFirst({
      where: { providerMessageId: dto.providerMessageId },
    });

    if (!notification) {
      this.logger.warn(`Webhook ${provider}: Message non trouvé (${dto.providerMessageId})`);
      return { received: true };
    }

    const now = this.clockService.now();
    await this.prisma.notification.update({
      where: { notificationId: notification.notificationId },
      data: {
        notificationStatus: dto.status === 'delivered' ? 'delivered' : 'failed',
        deliveredAt: dto.status === 'delivered' ? now : undefined,
        failureReason: dto.failureReason,
      },
    });

    return { success: true };
  }

  /**
   * Évaluation des seuils de notification consécutive à l'avancement d'une file (§4.1, §4.13)
   */
  async evaluateQueueThresholds(queueId: number) {
    const queue = await this.prisma.queue.findUnique({
      where: { queueId, isActive: true },
      include: { site: true },
    });
    if (!queue) return;

    const businessDate = new Date(this.clockService.getBusinessDate(queue.site.timezone));

    // Clients waiting classés par score de priorité décroissant
    const waitingCustomers = await this.prisma.customer.findMany({
      where: {
        queueId,
        businessDate,
        status: 'waiting',
        isActive: true,
        OR: [
          { entryType: 'walkin' },
          { entryType: 'appointment', appointmentStatus: 'checked_in' },
        ],
      },
      orderBy: { priorityReferenceTime: 'asc' },
      include: {
        person: true,
        queueTier: {
          include: {
            notificationRules: {
              where: { notificationType: 'threshold', isActive: true },
            },
          },
        },
      },
    });

    const activeSessionsCount = await this.prisma.queueSession.count({
      where: { queueId, disconnectedAt: null, mode: 'active' },
    });
    const threads = Math.max(1, activeSessionsCount);

    for (let i = 0; i < waitingCustomers.length; i++) {
      const customer = waitingCustomers[i];
      const position = i + 1;
      const estimatedWaitMinutes = Math.round((position * queue.averageWaitTime) / threads);

      for (const rule of customer.queueTier.notificationRules) {
        const triggersPosition = rule.thresholdPosition !== null && position <= rule.thresholdPosition;
        const triggersMinutes = rule.thresholdMinutes !== null && estimatedWaitMinutes <= rule.thresholdMinutes;

        if (triggersPosition || triggersMinutes) {
          // Vérification d'idempotence (§3.12, §4.1)
          const existingNotif = await this.prisma.notification.findFirst({
            where: {
              customerId: customer.customerId,
              notificationType: 'threshold',
              channel: rule.channel,
              notificationStatus: { not: 'failed' },
            },
          });

          if (!existingNotif) {
            const locale = customer.languagePreference || customer.person.languagePreference || 'fr';
            const recipient = rule.channel === 'email' ? customer.person.email : customer.person.phoneNumber;

            if (recipient) {
              await this.prisma.notification.create({
                data: {
                  customerId: customer.customerId,
                  ruleId: rule.ruleId,
                  channel: rule.channel,
                  notificationType: 'threshold',
                  locale,
                  recipient,
                  notificationContent: `${customer.person.firstName || 'Client'}, votre tour approche. Ticket ${customer.ticketNumber}. Position: ${position}, attente: ~${estimatedWaitMinutes} min.`,
                  notificationStatus: 'pending',
                },
              });
            }
          }
        }
      }
    }
  }
}
