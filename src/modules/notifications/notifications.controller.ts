import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriCreatedResponse,
  ApiDoriErrorResponses,
  ApiDoriPublicErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { NotificationsService } from './notifications.service';
import {
  SendManualNotificationDto,
  NotificationFilterDto,
  WebhookDeliveryDto,
} from './dto/notification.dto';
import {
  NotificationDetailDto,
  PaginatedNotificationResponseDto,
  WebhookResponseDto,
} from './dto/notification-response.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';
import { DoriException } from '../../core/errors/dori.exception';
import { Request } from 'express';

@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @Get('notifications')
  @RequirePermission('notification_view')
  @ApiOperation({
    summary: "Lister l'historique des notifications",
    description:
      'Retourne la liste paginée des notifications SMS et email envoyées ou en attente.',
  })
  @ApiDoriOkResponse(
    PaginatedNotificationResponseDto,
    'Liste paginée des notifications',
  )
  async findNotifications(
    @Query() filter: NotificationFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifService.findNotifications(filter, user);
  }

  @Get('notifications/:notificationId')
  @RequirePermission('notification_view')
  @ApiOperation({
    summary: "Détails d'une notification",
    description:
      "Retourne les informations complètes d'une notification (statut, destinataire, contenu, logs de remise).",
  })
  @ApiParam({
    name: 'notificationId',
    type: Number,
    description: 'ID de la notification',
  })
  @ApiDoriOkResponse(NotificationDetailDto, 'Détails de la notification')
  async findNotificationById(
    @Param('notificationId', ParseIntPipe) notificationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifService.findNotificationById(notificationId, user);
  }

  @Post('notifications')
  @RequirePermission('notification_send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Envoyer une notification manuelle',
    description:
      "Permet à un opérateur d'envoyer un SMS ou un e-mail personnalisé à un client.",
  })
  @ApiDoriCreatedResponse(
    NotificationDetailDto,
    "Notification enregistrée et mise en file d'envoi",
  )
  async sendManual(
    @Body() dto: SendManualNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifService.sendManualNotification(dto, user);
  }

  @Post('notifications/:notificationId/resend')
  @RequirePermission('notification_send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réémettre une notification échouée',
    description:
      "Réinsère une notification en statut pending pour une nouvelle tentative d'acheminement.",
  })
  @ApiParam({
    name: 'notificationId',
    type: Number,
    description: 'ID de la notification à renvoyer',
  })
  @ApiDoriOkResponse(NotificationDetailDto, 'Notification réémise')
  async resend(
    @Param('notificationId', ParseIntPipe) notificationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifService.resendNotification(notificationId, user);
  }

  // HMAC Webhook Route (§5.10, §8.3)
  @Public()
  @Post('webhooks/notifications/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  @ApiOperation({
    summary: 'Webhook de notification des opérateurs SMS/Email',
    description:
      'Réception des accusés de remise (delivery reports) validés par signature HMAC SHA-256.',
  })
  @ApiParam({
    name: 'provider',
    type: String,
    example: 'twilio',
    description: 'Nom du fournisseur de notification',
  })
  @ApiHeader({
    name: 'x-signature',
    description: 'Signature cryptographique HMAC SHA-256 du payload',
  })
  @ApiHeader({
    name: 'x-timestamp',
    description: "Timestamp UNIX d'émission du webhook",
  })
  @ApiDoriOkResponse(WebhookResponseDto, 'Accusé de réception du webhook')
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Headers('x-event-id') eventId: string,
    @Req() request: RawBodyRequest<Request>,
    @Body() dto: WebhookDeliveryDto,
  ) {
    // If Bearer token passed to webhook, reject immediately (§5.10)
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      throw new DoriException('UNAUTHENTICATED');
    }

    if (!signature || !timestamp || !eventId || !request.rawBody) {
      throw new DoriException('UNAUTHENTICATED');
    }

    return this.notifService.handleWebhook(
      provider,
      signature,
      timestamp,
      eventId,
      request.rawBody,
      dto,
    );
  }
}
