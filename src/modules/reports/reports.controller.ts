import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { ReportsService } from './reports.service';
import {
  DailyQueueReportResponseDto,
  DashboardSummaryResponseDto,
  DashboardQueueLoadItemDto,
} from './dto/report-response.dto';
import {
  DailyQueueReportQueryDto,
  DashboardSummaryQueryDto,
  DashboardQueueLoadQueryDto,
} from './dto/report-query.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Reports')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('queues/:queueId/daily')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: "Rapport journalier d'une file d'attente",
    description:
      "Retourne les volumes de fréquentation (inscrits, servis, no-show, annulations) et les indicateurs de performance (temps d'attente et service moyens).",
  })
  @ApiParam({
    name: 'queueId',
    type: Number,
    description: "ID de la file d'attente",
  })
  @ApiDoriOkResponse(
    DailyQueueReportResponseDto,
    'Rapport journalier détaillé de la file',
  )
  async getDailyQueueReport(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query() query: DailyQueueReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getDailyQueueReport(queueId, query.date, user);
  }

  @Get('dashboard/summary')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: 'Résumé global pour le tableau de bord de supervision',
    description:
      'Fournit une vue synthétique en temps réel : nombre de sites/files actifs, total en attente réparti entre sans rendez-vous et sur rendez-vous.',
  })
  @ApiDoriOkResponse(
    DashboardSummaryResponseDto,
    'Indicateurs de synthèse en temps réel',
  )
  async getDashboardSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardSummaryQueryDto,
  ) {
    return this.reportsService.getDashboardSummary(query.siteId, user);
  }

  @Get('dashboard/queue-load')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: "Charge des files d'attente les plus sollicitées",
    description:
      "Retourne les files d'attente triées par charge d'attente décroissante avec leur forfait dominant.",
  })
  @ApiDoriOkResponse(
    [DashboardQueueLoadItemDto],
    'Liste des files ordonnées par charge',
  )
  async getDashboardQueueLoad(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueueLoadQueryDto,
  ) {
    return this.reportsService.getDashboardQueueLoad(
      query.limit ?? 4,
      query.siteId,
      user,
    );
  }
}
