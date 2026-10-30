import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';
import {
  ApiDoriCreatedResponse,
  ApiDoriErrorResponses,
  ApiDoriOkResponse,
} from '../../core/swagger/api-dori-response.decorator';
import {
  CreateEdgeCommandDto,
  CreateEdgeInstallationDto,
  EdgeCommandResponseDto,
  EdgeInstallationCredentialResponseDto,
  EdgeInstallationDetailResponseDto,
  EdgeInstallationResponseDto,
  UpdateEdgeInstallationStatusDto,
} from './dto/edge-control.dto';
import { EdgeControlService } from './edge-control.service';

@ApiTags('Edge administration')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@RequirePermission('edge_installation_manage')
@Controller('api/v1/edge/installations')
export class EdgeAdminController {
  constructor(private readonly service: EdgeControlService) {}

  @Get()
  @ApiOperation({ summary: 'List registered intra installations' })
  @ApiDoriOkResponse([EdgeInstallationResponseDto])
  list() {
    return this.service.listInstallations();
  }

  @Post()
  @ApiOperation({
    summary: 'Register an intra installation and issue its one-time token',
  })
  @ApiDoriCreatedResponse(EdgeInstallationCredentialResponseDto)
  create(@Body() body: CreateEdgeInstallationDto) {
    return this.service.createInstallation(body.name);
  }

  @Patch(':installationId/status')
  @ApiOperation({ summary: 'Activate or deactivate an intra installation' })
  @ApiDoriOkResponse(EdgeInstallationResponseDto)
  updateStatus(
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @Body() body: UpdateEdgeInstallationStatusDto,
  ) {
    return this.service.updateDeploymentStatus(
      installationId,
      body.deploymentStatus,
    );
  }

  @Get(':installationId')
  @ApiOperation({
    summary: 'Get installation health and recent command history',
  })
  @ApiDoriOkResponse(EdgeInstallationDetailResponseDto)
  detail(@Param('installationId', ParseUUIDPipe) installationId: string) {
    return this.service.installationDetail(installationId);
  }

  @Post(':installationId/commands')
  @ApiOperation({ summary: 'Queue an allow-listed operational command' })
  @ApiDoriCreatedResponse(EdgeCommandResponseDto)
  command(
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @Body() body: CreateEdgeCommandDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createCommand(installationId, body, user.userId);
  }
}
