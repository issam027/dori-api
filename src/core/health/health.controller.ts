import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';

class HealthMemoryUsageDto {
  @ApiProperty({ example: 12345678 }) rss: number;
  @ApiProperty({ example: 9876543 }) heapTotal: number;
  @ApiProperty({ example: 7654321 }) heapUsed: number;
  @ApiProperty({ example: 1234567 }) external: number;
  @ApiProperty({ example: 0 }) arrayBuffers: number;
}

class HealthChecksDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  database: 'up' | 'down';

  @ApiProperty({ type: HealthMemoryUsageDto })
  memoryUsage: HealthMemoryUsageDto;
}

class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status: 'ok' | 'degraded';

  @ApiProperty({ example: '2026-09-28T15:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 3600.5, description: 'Uptime du process en secondes' })
  uptime: number;

  @ApiProperty({ type: HealthChecksDto })
  checks: HealthChecksDto;
}

@ApiTags('Health')
@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Vérification de santé complète (Health Check)',
    description:
      "Vérifie la connectivité à PostgreSQL, l'uptime et l'état de la mémoire du serveur",
  })
  @ApiResponse({
    status: 200,
    description: 'API et Base de données opérationnelles',
    type: HealthResponseDto,
    content: {
      'application/json': {
        example: {
          status: 'ok',
          timestamp: '2026-09-28T15:00:00.000Z',
          uptime: 3600.5,
          checks: {
            database: 'up',
            memoryUsage: {
              rss: 12345678,
              heapTotal: 9876543,
              heapUsed: 7654321,
              external: 1234567,
              arrayBuffers: 0,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Base de données inaccessible ou service dégradé',
    type: HealthResponseDto,
    content: {
      'application/json': {
        example: {
          status: 'degraded',
          timestamp: '2026-09-28T15:00:00.000Z',
          uptime: 3600.5,
          checks: {
            database: 'down',
            memoryUsage: {
              rss: 12345678,
              heapTotal: 9876543,
              heapUsed: 7654321,
              external: 1234567,
              arrayBuffers: 0,
            },
          },
        },
      },
    },
  })
  async check(@Res() res: Response) {
    let dbStatus = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    const isHealthy = dbStatus === 'up';
    const status = isHealthy ? 'ok' : 'degraded';
    const statusCode = isHealthy
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbStatus,
        memoryUsage: process.memoryUsage(),
      },
    });
  }
}
