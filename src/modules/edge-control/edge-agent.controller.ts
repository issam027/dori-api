import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/auth/decorators/public.decorator';
import { SkipResponseEnvelope } from '../../core/response/response.interceptor';
import {
  EdgeAgentInstallationStatusResponseDto,
  EdgeCommandCursorQueryDto,
  EdgeCommandResultDto,
  EdgeHeartbeatDto,
  EdgeRelayNotificationDto,
  EdgeTrackingBatchDto,
} from './dto/edge-control.dto';
import { EdgeControlService } from './edge-control.service';

@ApiTags('Edge agent')
@ApiSecurity('edge-installation-token')
@Public()
@SkipResponseEnvelope()
@Controller('api/edge/v1')
export class EdgeAgentController {
  constructor(private readonly service: EdgeControlService) {}

  @Get('status')
  @ApiOperation({ summary: 'Return the administrative deployment status' })
  async status(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<EdgeAgentInstallationStatusResponseDto> {
    await this.service.authenticate(installationId, authorization);
    return this.service.agentInstallationStatus(installationId);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept an installation heartbeat' })
  async heartbeat(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: EdgeHeartbeatDto,
  ): Promise<void> {
    await this.service.authenticate(installationId, authorization);
    await this.service.heartbeat(installationId, body);
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Relay one idempotent intra notification to Cloud' })
  async relayNotification(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: EdgeRelayNotificationDto,
  ) {
    await this.service.authenticate(installationId, authorization);
    return this.service.relayNotification(installationId, body);
  }

  @Post('tracking')
  @ApiOperation({ summary: 'Synchronize minimal public tracking projections' })
  async syncTracking(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: EdgeTrackingBatchDto,
  ) {
    await this.service.authenticate(installationId, authorization);
    return this.service.syncTracking(installationId, body.items);
  }

  @Get('commands')
  @ApiOperation({ summary: 'Pull allow-listed operational commands' })
  async commands(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Query() query: EdgeCommandCursorQueryDto,
  ) {
    await this.service.authenticate(installationId, authorization);
    return this.service.commands(installationId, query.after ?? null);
  }

  @Post('commands/:commandId/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Acknowledge durable local command receipt' })
  async acknowledge(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('commandId', ParseUUIDPipe) commandId: string,
  ): Promise<void> {
    await this.service.authenticate(installationId, authorization);
    await this.service.acknowledge(installationId, commandId);
  }

  @Post('commands/:commandId/result')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept an idempotent command result' })
  async complete(
    @Headers('x-dorify-installation-id') installationId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('commandId', ParseUUIDPipe) commandId: string,
    @Body() body: EdgeCommandResultDto,
  ): Promise<void> {
    await this.service.authenticate(installationId, authorization);
    await this.service.complete(installationId, commandId, body);
  }
}
