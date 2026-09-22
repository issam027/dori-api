import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';
import { Public } from '../../core/auth/jwt-auth.guard';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Santé & Supervision')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Sonde de disponibilité de la base de données et des services' })
  @ApiStandardResponse({
    type: HealthResponseDto,
    description: 'État de disponibilité de l’API et de la base de données',
  })
  async check() {
    let dbStatus = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch (e) {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'up',
      },
    };
  }
}
