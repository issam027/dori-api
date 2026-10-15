import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { ReportsService } from './reports.service';
import { ReportSeriesResponseDto } from './dto/report-response.dto';
import { ReportSeriesQueryDto } from './dto/report-query.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Reports')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('series')
  @RequirePermission('report_view')
  @ApiOperation({
    summary: 'Série de reporting sur une période',
    description:
      'Agrège une file, plusieurs files ou un site par jour, semaine ou mois.',
  })
  @ApiDoriOkResponse(ReportSeriesResponseDto, 'Série et synthèse de reporting')
  async getSeries(
    @Query() query: ReportSeriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getSeries(query, user);
  }
}
