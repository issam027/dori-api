import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import {
  ApiDoriOkResponse,
  ApiDoriPublicErrorResponses,
  ApiDoriRawResponse,
} from '../swagger/api-dori-response.decorator';
import {
  MonitoringActivityResponseDto,
  MonitoringHealthResponseDto,
  MonitoringMetricsResponseDto,
  MonitoringLiveResponseDto,
} from './dto/monitoring-response.dto';
import { MonitoringService } from './monitoring.service';
import { ReportsService } from '../../modules/reports/reports.service';
import { ReportSeriesQueryDto } from '../../modules/reports/dto/report-query.dto';
import { ReportSeriesResponseDto } from '../../modules/reports/dto/report-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { MonitoringLiveQueryDto } from './dto/monitoring-live-query.dto';

@ApiTags('Monitoring')
@Controller('api/v1/monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'État de santé de l’API et de PostgreSQL' })
  @ApiDoriRawResponse(
    HttpStatus.OK,
    'Service opérationnel',
    MonitoringHealthResponseDto,
  )
  @ApiDoriRawResponse(
    HttpStatus.SERVICE_UNAVAILABLE,
    'Service dégradé',
    MonitoringHealthResponseDto,
  )
  @ApiDoriPublicErrorResponses({ omit404: true, omit409: true, omit422: true })
  async health(@Res() response: Response) {
    const result = await this.monitoringService.health();
    return response
      .status(
        result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
      )
      .json(result);
  }

  @Get('metrics')
  @ApiBearerAuth('bearer')
  @RequirePermission('system_manage')
  @ApiOperation({ summary: 'Métriques techniques du processus et des workers' })
  @ApiDoriOkResponse(MonitoringMetricsResponseDto, 'Métriques techniques')
  metrics() {
    return this.monitoringService.metrics();
  }

  @Get('activity')
  @ApiBearerAuth('bearer')
  @RequirePermission('system_manage')
  @ApiOperation({
    summary: "Vue globale d'exploitation de la plateforme",
    description:
      'Réservée à l’exploitation système : notifications en attente ou en traitement, échecs des dernières 24 heures, sessions opérateur ouvertes et inscriptions non terminées. Ne remplace ni la supervision par site ni les rapports.',
  })
  @ApiDoriOkResponse(
    MonitoringActivityResponseDto,
    "État global d'exploitation",
  )
  activity() {
    return this.monitoringService.activity();
  }

  @Get('live')
  @ApiBearerAuth('bearer')
  @RequirePermission('queue_view')
  @ApiOperation({
    summary: "État opérationnel actuel d'un site",
    description:
      'Retourne les files, volumes courants, guichets et opérateurs actifs sans historique ni données personnelles.',
  })
  @ApiDoriOkResponse(MonitoringLiveResponseDto, 'Supervision opérationnelle')
  live(
    @Query() query: MonitoringLiveQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.monitoringService.live(query.siteId, user);
  }

  @Get('series')
  @ApiBearerAuth('bearer')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: 'Série d’activité sur une période',
    description:
      'Agrège en un appel les volumes, durées et ventilations par file, utilisateur, forfait, statut et type d’entrée. registered est attribué à createdAt ; served à servedAt ; noShow et cancelled à closedAt. Les durées incomplètes sont exclues des moyennes.',
  })
  @ApiDoriOkResponse(ReportSeriesResponseDto, 'Série et synthèse d’activité')
  series(
    @Query() query: ReportSeriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getSeries(query, user);
  }
}
