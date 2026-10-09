import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriCreatedResponse,
  ApiDoriErrorResponses,
  ApiDoriPublicErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { RegistrationsService } from './registrations.service';
import {
  CreateRegistrationDto,
  UpdateRegistrationDto,
  RescheduleRegistrationDto,
  LookupRegistrationDto,
  RegistrationFilterDto,
  RegistrationAvailabilityQueryDto,
} from './dto/registration.dto';
import {
  RegistrationResponseDto,
  CreateRegistrationResponseDto,
  RescheduleRegistrationResponseDto,
  PaginatedRegistrationResponseDto,
  RegistrationAvailabilityResponseDto,
  RegistrationPositionResponseDto,
  DeleteRegistrationResponseDto,
} from './dto/registration-response.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Registrations')
@ApiDoriErrorResponses()
@Controller('api/v1')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @ApiBearerAuth('bearer')
  @Get('queues/:queueId/availability')
  @RequirePermission('registration_register')
  @ApiOperation({
    summary: 'Disponibilité des créneaux de RDV',
    description:
      "Retourne la liste des créneaux horaires d'une date donnée avec leur capacité restante.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    RegistrationAvailabilityResponseDto,
    'Disponibilités des créneaux',
  )
  async getAvailability(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query() query: RegistrationAvailabilityQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.getAvailability(queueId, query, user);
  }

  @ApiBearerAuth('bearer')
  @Get('registrations')
  @RequirePermission('registration_view')
  @ApiOperation({
    summary: 'Lister les inscriptions',
    description:
      'Recherche et filtre paginé des inscriptions selon la file, la date ou le statut.',
  })
  @ApiDoriOkResponse(
    PaginatedRegistrationResponseDto,
    'Liste paginée des inscriptions',
  )
  async findRegistrations(
    @Query() filter: RegistrationFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.findRegistrations(filter, user);
  }

  @ApiBearerAuth('bearer')
  @Post('registrations')
  @RequirePermission('registration_register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Inscrire un client (Walk-in ou RDV)',
    description:
      'Génère un nouveau ticket pour un client présent sur place ou réserve un créneau de rendez-vous.',
  })
  @ApiDoriCreatedResponse(
    CreateRegistrationResponseDto,
    'Inscription effectuée avec ticket généré',
  )
  async register(
    @Body() dto: CreateRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.createRegistration(dto, user);
  }

  @ApiBearerAuth('bearer')
  @Get('registrations/lookup')
  @RequirePermission('appointment_lookup')
  @ApiOperation({
    summary: 'Rechercher un rendez-vous',
    description:
      "Retrouve un rendez-vous par son numéro de ticket ou par le nom et l'heure exacte.",
  })
  @ApiDoriOkResponse(RegistrationResponseDto, 'Rendez-vous trouvé')
  async lookup(
    @Query() dto: LookupRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.lookupAppointment(dto, user);
  }

  @ApiBearerAuth('bearer')
  @Get('registrations/:registrationId')
  @RequirePermission('registration_view')
  @ApiOperation({
    summary: "Détails d'une inscription",
    description:
      "Retourne les informations complètes d'une inscription par son identifiant.",
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription",
  })
  @ApiDoriOkResponse(RegistrationResponseDto, "Détails de l'inscription")
  async findOne(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.findRegistrationById(registrationId, user);
  }

  @ApiBearerAuth('bearer')
  @Patch('registrations/:registrationId')
  @RequirePermission('registration_edit')
  @ApiOperation({
    summary: 'Modifier une inscription',
    description:
      'Met à jour les informations rattachées à une inscription existante.',
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription",
  })
  @ApiDoriOkResponse(RegistrationResponseDto, 'Inscription mise à jour')
  async update(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @Body() dto: UpdateRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.updateRegistration(
      registrationId,
      dto,
      user,
    );
  }

  @ApiBearerAuth('bearer')
  @Post('registrations/:registrationId/reschedule')
  @RequirePermission('appointment_manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprogrammer un rendez-vous',
    description:
      'Déplace un rendez-vous vers une autre date et un autre créneau horaire disponible.',
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription",
  })
  @ApiDoriOkResponse(
    RescheduleRegistrationResponseDto,
    'Rendez-vous reprogrammé',
  )
  async reschedule(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @Body() dto: RescheduleRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.reschedule(registrationId, dto, user);
  }

  @ApiBearerAuth('bearer')
  @Post('registrations/:registrationId/check-in')
  @RequirePermission('appointment_checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Pointer l'arrivée d'un rendez-vous (Check-in)",
    description:
      "Confirme la présence du client au site pour l'intégrer dans la file active d'appel.",
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription",
  })
  @ApiDoriOkResponse(RegistrationResponseDto, 'Arrivée validée')
  async checkIn(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.checkIn(registrationId, user);
  }

  @ApiBearerAuth('bearer')
  @Delete('registrations/:registrationId')
  @RequirePermission('registration_delete')
  @ApiOperation({
    summary: 'Annuler une inscription',
    description: "Annule l'inscription ou le rendez-vous.",
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription",
  })
  @ApiDoriOkResponse(
    DeleteRegistrationResponseDto,
    'Inscription annulée avec succès',
  )
  async remove(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.cancelRegistration(registrationId, user);
  }

  @Public()
  @ApiSecurity('registration-token')
  @Get('public/registrations/position')
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  @ApiOperation({
    summary: "Suivi public de la position d'un ticket",
    description:
      "Permet à un client muni de son jeton de suivi (transmis par SMS ou via la propriété `registrationTrackingToken` retournée par `POST /registrations`) de connaître son rang et son temps d'attente estimé sans JWT utilisateur.",
  })
  @ApiDoriOkResponse(
    RegistrationPositionResponseDto,
    'Position actuelle dans la file',
  )
  async getPublicPosition(@Headers('X-Registration-Token') token: string) {
    return this.registrationsService.getPublicPosition(token);
  }
}
