import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import {
  CreateRegistrationDto,
  RescheduleAppointmentDto,
} from './dto/registration.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard, Public } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  AvailabilityResponseDto,
  RegistrationCreatedResponseDto,
  RegistrationDetailDto,
  RescheduleResponseDto,
  CheckInResponseDto,
  PublicPositionResponseDto,
} from './dto/registration-response.dto';
import { ActionSuccessResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Inscriptions & Rendez-vous')
@Controller()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('queues/:queueId/availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('appointment_manage')
  @ApiOperation({ summary: 'Créneaux disponibles calculés à la volée (§4.2)' })
  @ApiQuery({ name: 'date', required: true, example: '2026-09-20' })
  @ApiStandardResponse({
    type: AvailabilityResponseDto,
    description: 'Créneaux horaires avec capacité et disponibilité calculée',
  })
  async getAvailability(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query('date') dateStr: string,
  ) {
    if (!dateStr) throw new AppException(ErrorCode.VALIDATION_ERROR, { field: 'date' });
    return this.registrationsService.getAvailability(user, queueId, dateStr);
  }

  @Get('registrations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer_view')
  @ApiOperation({ summary: 'Liste paginée des inscriptions' })
  @ApiQuery({ name: 'queueId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'entryType', required: false })
  @ApiStandardResponse({
    type: RegistrationDetailDto,
    isPaginated: true,
    description: 'Liste paginée des inscriptions avec client, queue et statut',
  })
  async findAll(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationQueryDto,
    @Query('queueId') queueId?: number,
    @Query('status') status?: string,
    @Query('entryType') entryType?: string,
  ) {
    return this.registrationsService.findAll(
      user,
      pagination,
      queueId ? Number(queueId) : undefined,
      status,
      entryType,
    );
  }

  @Post('registrations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer_register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une inscription (walk-in ou RDV) (§6.5)' })
  @ApiStandardResponse({
    type: RegistrationCreatedResponseDto,
    status: HttpStatus.CREATED,
    description: 'Inscription créée, ticket attribué et lien de suivi généré',
  })
  async create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.registrationsService.create(user, dto);
  }

  @Get('registrations/:registrationId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer_view')
  @ApiOperation({ summary: "Détails d'une inscription" })
  @ApiStandardResponse({
    type: RegistrationDetailDto,
    description: "Fiche complète de l'inscription et statut d'avancement",
  })
  async findById(
    @CurrentUser() user: UserContext,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.registrationsService.findById(user, registrationId);
  }

  @Post('registrations/:registrationId/reschedule')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('appointment_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reprogrammer un rendez-vous (§6.6)' })
  @ApiStandardResponse({
    type: RescheduleResponseDto,
    description: 'Rendez-vous déplacé avec succès sur un nouveau créneau',
  })
  async reschedule(
    @CurrentUser() user: UserContext,
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.registrationsService.reschedule(user, registrationId, dto);
  }

  @Post('registrations/:registrationId/check-in')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('appointment_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Pointage d'arrivée (check-in) d'un RDV" })
  @ApiStandardResponse({
    type: CheckInResponseDto,
    description: 'Pointage enregistré et passage en file active validé',
  })
  async checkIn(
    @CurrentUser() user: UserContext,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.registrationsService.checkIn(user, registrationId);
  }

  @Delete('registrations/:registrationId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer_delete')
  @ApiOperation({ summary: 'Annuler une inscription (soft delete)' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Inscription annulée avec succès',
  })
  async delete(
    @CurrentUser() user: UserContext,
    @Param('registrationId', ParseIntPipe) registrationId: number,
  ) {
    return this.registrationsService.delete(user, registrationId);
  }

  // ---------------------------------------------------------------------------
  // Suivi public de position (§5.12, §6.8)
  // ---------------------------------------------------------------------------
  @Public()
  @Get('public/registrations/position')
  @ApiOperation({ summary: 'Suivi public de position (authentifié par X-Registration-Token)' })
  @ApiHeader({ name: 'X-Registration-Token', required: true, description: 'UUID du jeton de suivi' })
  @ApiStandardResponse({
    type: PublicPositionResponseDto,
    description: 'Position en temps réel dans la file et estimation d’attente',
  })
  async getPublicPosition(@Headers('x-registration-token') token?: string) {
    if (!token) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: "L'en-tête X-Registration-Token est obligatoire",
      });
    }
    return this.registrationsService.getPublicPosition(token);
  }
}
