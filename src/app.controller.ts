import { Controller, Get, HttpStatus, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './core/auth/decorators/public.decorator';
import {
  ApiDoriPublicErrorResponses,
  ApiDoriRawResponse,
} from './core/swagger/api-dori-response.decorator';

@ApiTags('Système')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Accueil API' })
  @ApiDoriPublicErrorResponses({
    omit404: true,
    omit409: true,
    omit422: true,
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @Redirect('/api/v1/health', HttpStatus.MOVED_PERMANENTLY)
  @ApiOperation({
    summary: 'Redirection vers le bilan de santé unifié',
    description:
      'Redirige de manière permanente (301) vers le point de contrôle de santé complet /api/v1/health',
  })
  @ApiDoriRawResponse(
    HttpStatus.MOVED_PERMANENTLY,
    'Redirection permanente vers /api/v1/health',
  )
  getHealth() {
    return { url: '/api/v1/health' };
  }
}
