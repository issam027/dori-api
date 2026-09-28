import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiDoriOkResponse } from '../../core/swagger/api-dori-response.decorator';
import { ReportsService } from './reports.service';
import {
  DailyQueueReportResponseDto,
  DashboardSummaryResponseDto,
  DashboardQueueLoadItemDto,
} from './dto/report-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Reports')
@ApiBearerAuth('bearer')
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
  @ApiQuery({
    name: 'date',
    type: String,
    example: '2026-09-27',
    description: "Date d'activité (format YYYY-MM-DD)",
  })
  @ApiDoriOkResponse(
    DailyQueueReportResponseDto,
    'Rapport journalier détaillé de la file',
  )
  async getDailyQueueReport(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getDailyQueueReport(queueId, date, user);
  }

  @Get('dashboard/summary')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: 'Résumé global pour le tableau de bord de supervision',
    description:
      'Fournit une vue synthétique en temps réel : nombre de sites/files actifs, total en attente réparti entre sans rendez-vous et sur rendez-vous.',
  })
  @ApiQuery({
    name: 'siteId',
    type: Number,
    required: false,
    description: 'Filtrer par site spécifique (optionnel)',
  })
  @ApiDoriOkResponse(
    DashboardSummaryResponseDto,
    'Indicateurs de synthèse en temps réel',
  )
  async getDashboardSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.reportsService.getDashboardSummary(
      siteId ? parseInt(siteId, 10) : undefined,
      user,
    );
  }

  @Get('dashboard/queue-load')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: "Charge des files d'attente les plus sollicitées",
    description:
      "Retourne les files d'attente triées par charge d'attente décroissante avec leur forfait dominant.",
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    example: 4,
    description: 'Nombre maximum de files à retourner (par défaut 4)',
  })
  @ApiQuery({
    name: 'siteId',
    type: Number,
    required: false,
    description: 'Filtrer par site spécifique',
  })
  @ApiDoriOkResponse(
    [DashboardQueueLoadItemDto],
    'Liste des files ordonnées par charge',
  )
  async getDashboardQueueLoad(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.reportsService.getDashboardQueueLoad(
      limit ? parseInt(limit, 10) : 4,
      siteId ? parseInt(siteId, 10) : undefined,
      user,
    );
  }
}
