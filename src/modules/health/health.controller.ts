import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';
import { Public } from '../../core/auth/jwt-auth.guard';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Santé & Supervision')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) { }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Sonde de disponibilité de la base de données et des services' })
  @ApiStandardResponse({
    type: HealthResponseDto,
    description: 'État de disponibilité de l’API, de la base de données et du frontend',
  })
  async check() {
    const [dbStatus, frontendStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkFrontend(),
    ]);

    const allUp = dbStatus === 'up' && frontendStatus === 'up';

    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'up',
        frontend: frontendStatus,
      },
    };
  }

  private async checkDatabase(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkFrontend(): Promise<string> {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      return 'not_configured';
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(frontendUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}