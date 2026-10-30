import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDoriErrorResponses,
  ApiDoriOkResponse,
} from '../../core/swagger/api-dori-response.decorator';
import { EdgeLocalStatusResponseDto } from './dto/edge-control.dto';
import { EdgeLocalStatusService } from './edge-local-status.service';

@ApiTags('Edge local status')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses({ omit403: true, omit404: true })
@Controller('api/v1/edge/local-status')
export class EdgeLocalController {
  constructor(private readonly service: EdgeLocalStatusService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the non-blocking cloud status reported by the local agent',
  })
  @ApiDoriOkResponse(EdgeLocalStatusResponseDto)
  status() {
    return this.service.getStatus();
  }
}
