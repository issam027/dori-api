import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Vérification de santé (Health Check)' })
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
