import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { WebhookNotificationDto } from './dto/notification.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard, Public } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ActionSuccessResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('notification_view')
  @ApiOperation({ summary: "Historique paginé des notifications" })
  @ApiQuery({ name: 'registrationId', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiStandardResponse({
    type: NotificationResponseDto,
    isPaginated: true,
    description: 'Historique des notifications filtrées par canal ou statut',
  })
  async findAll(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationQueryDto,
    @Query('registrationId') registrationId?: number,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
  ) {
    return this.notificationsService.findAll(
      user,
      pagination,
      registrationId ? Number(registrationId) : undefined,
      channel,
      status,
    );
  }

  @Get('notifications/:notificationId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('notification_view')
  @ApiOperation({ summary: "Détails d'une notification" })
  @ApiStandardResponse({
    type: NotificationResponseDto,
    description: 'Détails du message, statut de livraison et destinataire',
  })
  async findById(
    @CurrentUser() user: UserContext,
    @Param('notificationId', ParseIntPipe) notificationId: number,
  ) {
    return this.notificationsService.findById(user, notificationId);
  }

  @Post('notifications/:notificationId/resend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('notification_send')
  @ApiOperation({ summary: 'Renvoyer manuellement une notification en échec' })
  @ApiStandardResponse({
    type: NotificationResponseDto,
    description: 'Notification remise en file d’attente d’envoi',
  })
  async resend(
    @CurrentUser() user: UserContext,
    @Param('notificationId', ParseIntPipe) notificationId: number,
  ) {
    return this.notificationsService.resend(user, notificationId);
  }

  @Public()
  @Post('webhooks/notifications/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook fournisseur de mise à jour du statut de notification' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Statut du message mis à jour via webhook',
  })
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() dto: WebhookNotificationDto,
  ) {
    return this.notificationsService.handleWebhook(provider, dto);
  }
}
