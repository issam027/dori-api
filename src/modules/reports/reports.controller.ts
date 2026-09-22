import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import { QueueDailyReportResponseDto } from './dto/report-response.dto';

@ApiTags('Rapports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('queues/:queueId/daily')
  @RequirePermission('report_view')
  @ApiOperation({ summary: "Rapport quotidien d'une file (volumétrie, attente, absences)" })
  @ApiQuery({ name: 'date', required: false, example: '2026-09-20' })
  @ApiStandardResponse({
    type: QueueDailyReportResponseDto,
    description: `Métriques journalières consolidées pour la file : volume, taux d'absence, temps d'attente moyen`,
  })
  async getQueueDailyReport(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query('date') dateStr?: string,
  ) {
    return this.reportsService.getQueueDailyReport(user, queueId, dateStr);
  }
}
