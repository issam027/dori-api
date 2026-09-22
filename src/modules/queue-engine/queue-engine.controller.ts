import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueueEngineService } from './queue-engine.service';
import { OpenSessionDto } from './dto/session.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  OpenSessionResponseDto,
  CallNextResponseDto,
  CompleteRegistrationResponseDto,
} from './dto/queue-engine-response.dto';
import { ActionSuccessResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Guichets & Traitement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class QueueEngineController {
  constructor(private readonly queueEngineService: QueueEngineService) {}

  @Post('queues/:queueId/sessions')
  @RequirePermission('session_operate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ouvrir ou reprendre un guichet (§6.2)' })
  @ApiStandardResponse({
    type: OpenSessionResponseDto,
    status: HttpStatus.CREATED,
    description: 'Session de guichet ouverte ou reprise (reprise transparente (§6.2))',
  })
  async openSession(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: OpenSessionDto,
  ) {
    return this.queueEngineService.openSession(user, queueId, dto);
  }

  @Delete('queues/:queueId/sessions/:sessionId')
  @RequirePermission('session_operate')
  @ApiOperation({ summary: 'Fermer et libérer un guichet' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Guichet fermé et session terminée',
  })
  async closeSession(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.queueEngineService.closeSession(user, queueId, sessionId);
  }

  @Post('queues/:queueId/next')
  @RequirePermission('customer_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Appeler le client suivant dans la file (§6.3)' })
  @ApiStandardResponse({
    type: CallNextResponseDto,
    description: 'Client sélectionné selon le score de priorité dynamique (ou null si file vide)',
  })
  async callNext(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.queueEngineService.callNext(user, queueId);
  }

  @Post('registrations/:registrationId/served')
  @RequirePermission('customer_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer un client comme servi (§6.4)' })
  @ApiStandardResponse({
    type: CompleteRegistrationResponseDto,
    description: 'Client marqué comme servi',
  })
  async markServed(
    @CurrentUser() user: UserContext,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.queueEngineService.markServed(user, registrationId);
  }

  @Post('registrations/:registrationId/no-show')
  @RequirePermission('customer_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marquer un client absent / non présenté (§6.4)' })
  @ApiStandardResponse({
    type: CompleteRegistrationResponseDto,
    description: 'Client marqué comme non présenté',
  })
  async markNoShow(
    @CurrentUser() user: UserContext,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.queueEngineService.markNoShow(user, registrationId);
  }
}
