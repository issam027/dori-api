import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../core/auth/decorators/public.decorator';
import {
  ApiDoriOkResponse,
  ApiDoriPublicErrorResponses,
} from '../core/swagger/api-dori-response.decorator';
import { AppointmentExpiryWorker } from '../workers/appointment-expiry/appointment-expiry.worker';
import { DailyResetWorker } from '../workers/daily-reset/daily-reset.worker';
import { NotificationWorker } from '../workers/notification-worker/notification.worker';
import { QueueEstimationWorker } from '../workers/queue-estimation/queue-estimation.worker';
import { CronExecutionResponseDto } from './dto/cron-execution-response.dto';

@Public()
@ApiTags('ScheduledTasks')
@ApiBearerAuth('cron-secret')
@Controller('api/internal/cron')
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly dailyReset: DailyResetWorker,
    private readonly appointmentExpiry: AppointmentExpiryWorker,
    private readonly notificationWorker: NotificationWorker,
    private readonly queueEstimation: QueueEstimationWorker,
  ) {}

  private async run(
    authorization: string | undefined,
    task: () => Promise<void>,
  ) {
    const secret = this.config.get<string>('cron.secret');
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
    await task();
    return { accepted: true };
  }

  @Get('daily-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réinitialiser les files pour la nouvelle journée',
    description:
      'Clôture les inscriptions encore actives de la journée précédente et prépare les files pour la date métier courante.',
  })
  @ApiDoriOkResponse(
    CronExecutionResponseDto,
    'Réinitialisation quotidienne exécutée',
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  dailyResetCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () => this.dailyReset.handleDailyReset());
  }

  @Get('appointment-expiry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Traiter les rendez-vous expirés',
    description:
      "Identifie les rendez-vous dont l'heure de passage est dépassée et applique les règles d'expiration configurées.",
  })
  @ApiDoriOkResponse(
    CronExecutionResponseDto,
    'Traitement des rendez-vous expirés exécuté',
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  appointmentExpiryCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () =>
      this.appointmentExpiry.handleAppointmentExpiry(),
    );
  }

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer les notifications en attente',
    description:
      'Traite la file des notifications en attente et déclenche leur envoi selon leur canal.',
  })
  @ApiDoriOkResponse(
    CronExecutionResponseDto,
    'Traitement des notifications exécuté',
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  notificationCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () =>
      this.notificationWorker.processPendingNotifications(),
    );
  }

  @Get('queue-estimation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Actualiser les estimations d'attente",
    description:
      "Recalcule les estimations de temps d'attente des files actives à partir de leur état courant.",
  })
  @ApiDoriOkResponse(
    CronExecutionResponseDto,
    "Actualisation des estimations d'attente exécutée",
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  queueEstimationCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () =>
      this.queueEstimation.handleQueueEstimation(),
    );
  }
}
