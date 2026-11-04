import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/auth/decorators/public.decorator';
import {
  ApiDoriOkResponse,
  ApiDoriPublicErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import {
  LocalAnnouncementsResponseDto,
  PublicAnnouncementsQueryDto,
} from './dto/announcement.dto';
import { LocalAnnouncementsService } from './local-announcements.service';

@ApiTags('Public announcements')
@Public()
@Controller('api/v1/public/announcements')
export class LocalAnnouncementsController {
  constructor(private readonly announcements: LocalAnnouncementsService) {}
  @Get()
  @ApiOperation({
    summary:
      'Read only the currently visible operational notices for this local installation',
  })
  @ApiDoriOkResponse(LocalAnnouncementsResponseDto)
  @ApiDoriPublicErrorResponses({ omit404: true, omit409: true, omit422: true })
  async list(@Query() query: PublicAnnouncementsQueryDto) {
    const { items, observedAt } = await this.announcements.read(
      query.queueId
        ? await this.announcements.siteForQueue(query.queueId)
        : query.siteId,
    );
    return { items, observedAt };
  }
}
