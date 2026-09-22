import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { OpenSessionDto } from './dto/session.dto';
import { resolveQueueConfig } from '../queues/queue-config.helper';

@Injectable()
export class QueueEngineService {
  private readonly logger = new Logger(QueueEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  // ---------------------------------------------------------------------------
  // 6.2 Ouverture ou reprise d'un guichet
  // ---------------------------------------------------------------------------
  async openSession(user: UserContext, queueId: number, dto: OpenSessionDto) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findUnique({
      where: { queueId, isActive: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    const now = this.clockService.now();

    // Mode consultation seule : pas de guichet physique requis
    if (dto.mode === 'consultation_only') {
      const session = await this.prisma.queueSession.create({
        data: {
          queueId,
          userId: user.userId,
          threadNumber: null,
          mode: 'consultation_only',
          connectedAt: now,
          lastSeenAt: now,
        },
      });

      return {
        code: 'OK',
        translationKey: 'session.connected_readonly',
        translationParams: {},
        data: {
          sessionId: session.sessionId,
          queueId: session.queueId,
          userId: session.userId,
          threadNumber: null,
          mode: 'consultation_only',
          connectedAt: session.connectedAt.toISOString(),
        },
      };
    }

    // Mode actif : threadNumber obligatoire et <= threadCount
    if (!dto.threadNumber || dto.threadNumber < 1 || dto.threadNumber > queue.threadCount) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        field: 'threadNumber',
        message: `Le numéro de guichet doit être compris entre 1 et ${queue.threadCount}`,
      });
    }

    // Vérifier si l'utilisateur a déjà une session active sur cette même queue (index unique §3.9)
    const existingUserSession = await this.prisma.queueSession.findFirst({
      where: {
        queueId,
        userId: user.userId,
        disconnectedAt: null,
      },
    });
    if (existingUserSession) {
      throw new AppException(ErrorCode.SESSION_ALREADY_OPEN, { queueId });
    }

    return this.prisma.$transaction(async (tx) => {
      // Vérifier si le guichet est occupé
      const existingSession = await tx.queueSession.findFirst({
        where: {
          queueId,
          threadNumber: dto.threadNumber,
          disconnectedAt: null,
        },
        include: {
          user: { select: { userId: true, username: true } },
        },
      });

      if (existingSession && !dto.takeOver) {
        // 409 THREAD_OCCUPIED (§6.2)
        const inactiveMinutes = this.clockService.diffInMinutes(now, existingSession.lastSeenAt);
        throw new AppException(
          ErrorCode.THREAD_OCCUPIED,
          {
            threadNumber: dto.threadNumber,
            username: existingSession.user.username,
            inactiveMinutes,
          },
          {
            threadNumber: dto.threadNumber,
            occupiedBy: {
              userId: existingSession.user.userId,
              username: existingSession.user.username,
              lastSeenAt: existingSession.lastSeenAt.toISOString(),
            },
          },
        );
      }

      let takenOverFromSessionId: number | null = null;
      let reassignedRegistrationId: number | null = null;

      if (existingSession && dto.takeOver) {
        takenOverFromSessionId = existingSession.sessionId;

        // Fermeture de l'ancienne session
        await tx.queueSession.update({
          where: { sessionId: existingSession.sessionId },
          data: {
            disconnectedAt: now,
            closureReason: 'taken_over',
            closedByUserId: user.userId,
          },
        });

        // Réaffectation d'un client in_progress le cas échéant (§4.6)
        const clientInProgress = await tx.customer.findFirst({
          where: {
            currentSessionId: existingSession.sessionId,
            status: 'in_progress',
            isActive: true,
          },
        });

        if (clientInProgress) {
          reassignedRegistrationId = clientInProgress.customerId;
        }
      }

      // Création de la nouvelle session
      const newSession = await tx.queueSession.create({
        data: {
          queueId,
          userId: user.userId,
          threadNumber: dto.threadNumber,
          mode: 'active',
          connectedAt: now,
          lastSeenAt: now,
        },
      });

      // Si un client a été repris, on met à jour son current_session_id
      if (reassignedRegistrationId) {
        await tx.customer.update({
          where: { customerId: reassignedRegistrationId },
          data: { currentSessionId: newSession.sessionId },
        });
      }

      return {
        code: 'OK',
        translationKey: 'session.connected',
        translationParams: { threadNumber: dto.threadNumber },
        data: {
          sessionId: newSession.sessionId,
          queueId: newSession.queueId,
          userId: newSession.userId,
          threadNumber: newSession.threadNumber,
          mode: 'active',
          connectedAt: newSession.connectedAt.toISOString(),
          takenOverFromSessionId,
          reassignedRegistrationId,
        },
      };
    });
  }

  /**
   * Fermeture d'une session de guichet (§5.8)
   */
  async closeSession(user: UserContext, queueId: number, sessionId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const session = await this.prisma.queueSession.findFirst({
      where: { sessionId, queueId, disconnectedAt: null },
    });
    if (!session) return { success: true };

    await this.prisma.queueSession.update({
      where: { sessionId },
      data: {
        disconnectedAt: this.clockService.now(),
        closureReason: 'logout',
        closedByUserId: user.userId,
      },
    });

    return { success: true };
  }

  /**
   * 6.3 Appel du suivant (opération critique avec SELECT ... FOR UPDATE SKIP LOCKED)
   */
  async callNext(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    // Résolution de la session active de l'opérateur sur cette file (§6.3)
    const activeSession = await this.prisma.queueSession.findFirst({
      where: {
        queueId,
        userId: user.userId,
        disconnectedAt: null,
        mode: 'active',
      },
    });

    if (!activeSession || activeSession.threadNumber === null) {
      throw new AppException(ErrorCode.THREAD_UNAVAILABLE);
    }

    const queue = await this.prisma.queue.findUnique({
      where: { queueId },
      include: { site: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    const effectiveConfig = resolveQueueConfig(queue, queue.site);
    const businessDateStr = this.clockService.getBusinessDate(queue.site.timezone);
    const now = this.clockService.now();

    const qBaseAppt = effectiveConfig.baseWeightAppointment.value;
    const qRateAppt = effectiveConfig.escalationRateAppointment.value;
    const qBaseWalk = effectiveConfig.baseWeightWalkin.value;
    const qRateWalk = effectiveConfig.escalationRateWalkin.value;

    return this.prisma.$transaction(async (tx) => {
      // 1. Première passe : Inscriptions éligibles avec score de priorité (§4.4, §7.6)
      const eligibleRows: any[] = await tx.$queryRaw`
        WITH eligible AS (
          SELECT c.customer_id,
                 CASE WHEN c.entry_type = 'appointment'
                      THEN ${qBaseAppt} + EXTRACT(EPOCH FROM (now() - c.priority_reference_time))/60 * ${qRateAppt}
                      ELSE ${qBaseWalk} + EXTRACT(EPOCH FROM (now() - c.priority_reference_time))/60 * ${qRateWalk}
                 END AS score
          FROM dori_customer c
          WHERE c.queue_id = ${queueId}
            AND c.business_date = ${businessDateStr}::date
            AND c.status = 'waiting'
            AND c.is_active = TRUE
            AND ( c.entry_type = 'walkin'
                  OR (c.appointment_status = 'checked_in' AND c.scheduled_time <= now()) )
        )
        SELECT customer_id, score FROM eligible
        ORDER BY score DESC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
      `;

      let selectedCustomerId: number | null = null;
      let calculatedScore: number = 0;
      let calledEarly = false;

      if (eligibleRows.length > 0) {
        selectedCustomerId = eligibleRows[0].customer_id;
        calculatedScore = Number(eligibleRows[0].score);
      } else {
        // 2. Seconde passe : Repli RDV anticipé (§4.4)
        const fallbackRows: any[] = await tx.$queryRaw`
          SELECT customer_id
          FROM dori_customer
          WHERE queue_id = ${queueId}
            AND business_date = ${businessDateStr}::date
            AND status = 'waiting'
            AND is_active = TRUE
            AND appointment_status = 'checked_in'
            AND scheduled_time > now()
          ORDER BY scheduled_time ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1;
        `;

        if (fallbackRows.length > 0) {
          selectedCustomerId = fallbackRows[0].customer_id;
          calculatedScore = 0;
          calledEarly = true;
        }
      }

      // File vide (§6.3)
      if (!selectedCustomerId) {
        return {
          code: 'QUEUE_EMPTY',
          translationKey: 'queue.next.empty',
          translationParams: {},
          data: null,
        };
      }

      // 3. Mise à jour atomique vers 'in_progress'
      const updatedCustomer = await tx.customer.update({
        where: { customerId: selectedCustomerId },
        data: {
          status: 'in_progress',
          currentSessionId: activeSession.sessionId,
          calledAt: now,
        },
        include: {
          person: {
            include: {
              notes: { where: { isActive: true }, select: { noteId: true }, take: 1 },
            },
          },
          queueTier: {
            include: { tier: true },
          },
        },
      });

      return {
        code: 'OK',
        translationKey: 'queue.next.called',
        translationParams: { ticketNumber: updatedCustomer.ticketNumber },
        data: {
          registrationId: updatedCustomer.customerId,
          ticketNumber: updatedCustomer.ticketNumber,
          entryType: updatedCustomer.entryType,
          scheduledTime: updatedCustomer.scheduledTime?.toISOString() || null,
          calledEarly,
          tier: {
            tierId: updatedCustomer.queueTier.tier.tierId,
            tierCode: updatedCustomer.queueTier.tier.tierCode,
            tierName: updatedCustomer.queueTier.tier.tierName,
          },
          status: 'in_progress',
          sessionId: activeSession.sessionId,
          threadNumber: activeSession.threadNumber,
          priorityScore: Math.round(calculatedScore * 10) / 10,
          calledAt: updatedCustomer.calledAt?.toISOString(),
          person: {
            personId: updatedCustomer.person.personId,
            firstName: updatedCustomer.person.firstName,
            lastName: updatedCustomer.person.lastName,
            phone: updatedCustomer.person.phoneNumber,
            hasNotes: updatedCustomer.person.notes.length > 0,
          },
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 6.4 Clôture d'un client (served / no-show)
  // ---------------------------------------------------------------------------
  async markServed(user: UserContext, registrationId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { customerId: registrationId },
      include: { currentSession: true },
    });

    if (!customer) {
      throw new AppException(ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
    }

    await this.scopeService.validateQueueScope(user, customer.queueId);

    if (customer.status !== 'in_progress') {
      throw new AppException(ErrorCode.REGISTRATION_NOT_IN_PROGRESS, { status: customer.status });
    }

    const now = this.clockService.now();

    const updated = await this.prisma.customer.update({
      where: { customerId: registrationId },
      data: {
        status: 'served',
        servedAt: now,
        closedAt: now,
      },
    });

    return {
      code: 'OK',
      translationKey: 'registration.served',
      translationParams: {},
      data: {
        registrationId: updated.customerId,
        status: 'served',
        servedAt: updated.servedAt?.toISOString(),
        closedAt: updated.closedAt?.toISOString(),
        handledBySessionId: customer.currentSessionId,
        handledByUserId: customer.currentSession?.userId || user.userId,
      },
    };
  }

  async markNoShow(user: UserContext, registrationId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { customerId: registrationId },
      include: { currentSession: true },
    });

    if (!customer) {
      throw new AppException(ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
    }

    await this.scopeService.validateQueueScope(user, customer.queueId);

    if (customer.status !== 'in_progress') {
      throw new AppException(ErrorCode.REGISTRATION_NOT_IN_PROGRESS, { status: customer.status });
    }

    const now = this.clockService.now();

    const updated = await this.prisma.customer.update({
      where: { customerId: registrationId },
      data: {
        status: 'no_show',
        servedAt: null,
        closedAt: now,
      },
    });

    return {
      code: 'OK',
      translationKey: 'registration.no_show',
      translationParams: {},
      data: {
        registrationId: updated.customerId,
        status: 'no_show',
        servedAt: null,
        closedAt: updated.closedAt?.toISOString(),
        handledBySessionId: customer.currentSessionId,
        handledByUserId: customer.currentSession?.userId || user.userId,
      },
    };
  }
}
