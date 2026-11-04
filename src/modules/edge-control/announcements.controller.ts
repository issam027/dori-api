import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequireAnyPermission } from '../../core/rbac/decorators/require-permission.decorator';
import { AuditEvent } from '../../core/audit/audit-event.decorator';
import {
  ApiDoriCreatedResponse,
  ApiDoriErrorResponses,
  ApiDoriOkResponse,
} from '../../core/swagger/api-dori-response.decorator';
import {
  CreateAnnouncementDto,
  AnnouncementResponseDto,
  WithdrawAnnouncementResponseDto,
  PaginatedAnnouncementResponseDto,
  AnnouncementQueryDto,
} from './dto/announcement.dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('Announcements')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@RequireAnyPermission('edge_installation_manage', 'site_edit')
@Controller('api/v1/announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}
  @Get()
  @ApiOperation({
    summary:
      'List operational announcements and their explicit target installations or local sites',
  })
  @ApiDoriOkResponse(PaginatedAnnouncementResponseDto)
  list(
    @Query() query: AnnouncementQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(query, user);
  }
  @Post()
  @ApiOperation({
    summary:
      'Publish a time-bounded notice to one or more installations or local sites',
  })
  @ApiDoriCreatedResponse(AnnouncementResponseDto)
  @AuditEvent({
    action: 'announcement.publish',
    targetType: 'announcement',
    targetResponseField: 'announcementId',
  })
  create(
    @Body() body: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(body, user);
  }
  @Delete(':announcementId')
  @ApiOperation({
    summary: 'Withdraw an announcement while preserving its audit history',
  })
  @ApiDoriOkResponse(WithdrawAnnouncementResponseDto)
  @AuditEvent({
    action: 'announcement.withdraw',
    targetType: 'announcement',
    targetParam: 'announcementId',
  })
  withdraw(
    @Param('announcementId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.withdraw(id, user);
  }
}
