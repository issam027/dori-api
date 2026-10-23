import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ApiDoriErrorResponses,
  ApiDoriOkResponse,
} from '../swagger/api-dori-response.decorator';
import { AuditService } from './audit.service';
import { AuditEventQueryDto } from './dto/audit-query.dto';
import {
  AuditEventDetailResponseDto,
  PaginatedAuditEventResponseDto,
} from './dto/audit-response.dto';

@ApiTags('Audit')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1/audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('audit_view')
  @ApiOperation({
    summary: "Rechercher le journal d'audit",
    description:
      'Liste paginée réservée aux managers, administrateurs et root, filtrée selon leur périmètre. Les filtres sont combinables et la période est limitée à 366 jours.',
  })
  @ApiDoriOkResponse(
    PaginatedAuditEventResponseDto,
    "Résultats de la recherche d'audit",
  )
  search(
    @Query() query: AuditEventQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.search(query, user);
  }

  @Get(':eventId')
  @RequirePermission('audit_view')
  @ApiOperation({ summary: "Consulter un événement d'audit" })
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiDoriOkResponse(
    AuditEventDetailResponseDto,
    "Détail enrichi de l'événement d'audit",
  )
  findById(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.findById(eventId, user);
  }
}
