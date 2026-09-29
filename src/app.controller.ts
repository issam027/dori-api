import { Controller, Get, HttpStatus, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './core/auth/decorators/public.decorator';

@ApiTags('Système')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Accueil API' })
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
  @ApiResponse({
    status: HttpStatus.MOVED_PERMANENTLY,
    description: 'Redirection permanente vers /api/v1/health',
  })
  getHealth() {
    return { url: '/api/v1/health' };
  }
}

