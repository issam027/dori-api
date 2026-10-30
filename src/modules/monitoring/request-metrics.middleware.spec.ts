import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpException,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Response } from 'express';
import * as request from 'supertest';
import { DoriException } from '../../core/errors/dori.exception';
import { GlobalExceptionFilter } from '../../core/errors/global-exception.filter';
import { MonitoringService } from './monitoring.service';
import { RequestMetricsMiddleware } from './request-metrics.middleware';

@Injectable()
class RejectGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { params } = context
      .switchToHttp()
      .getRequest<{ params: { status: string } }>();
    throw new HttpException('denied', Number(params.status));
  }
}

@Controller()
class MetricsTestController {
  @Get('guard/:status')
  @UseGuards(RejectGuard)
  denied() {
    return {};
  }

  @Get('conflict')
  conflict() {
    throw new DoriException('CONFLICT');
  }

  @Get('ok')
  ok() {
    return {};
  }

  @Get('invalid')
  invalid() {
    throw new HttpException('invalid', 400);
  }

  @Get('unexpected')
  unexpected() {
    throw new Error('unexpected');
  }

  @Get('events')
  events(@Res() response: Response) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.end('data: hello\n\n');
  }
}

describe('HTTP request metrics', () => {
  let app: INestApplication;
  const metrics = { increment: jest.fn() };

  beforeAll(async () => {
    @Module({
      controllers: [MetricsTestController],
      providers: [
        RejectGuard,
        RequestMetricsMiddleware,
        { provide: MonitoringService, useValue: metrics },
      ],
    })
    class MetricsTestModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestMetricsMiddleware).forRoutes('*');
      }
    }
    const module = await Test.createTestingModule({
      imports: [MetricsTestModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  beforeEach(() => metrics.increment.mockClear());
  afterAll(async () => {
    await app.close();
  });

  it.each([401, 403, 429])(
    'counts a guard refusal with final status %s',
    async (status) => {
      await request(app.getHttpServer()).get(`/guard/${status}`).expect(status);
      expect(metrics.increment).toHaveBeenCalledWith(
        `http_responses_status_${status}_total`,
      );
      expect(metrics.increment).not.toHaveBeenCalledWith(
        'http_responses_status_200_total',
      );
      expect(
        metrics.increment.mock.calls.filter(
          ([key]) => key === 'http_requests_total',
        ),
      ).toHaveLength(1);
    },
  );

  it('records the status written by the exception filter', async () => {
    await request(app.getHttpServer()).get('/conflict').expect(409);
    expect(metrics.increment).toHaveBeenCalledWith(
      'http_responses_status_409_total',
    );
    expect(metrics.increment).not.toHaveBeenCalledWith(
      'http_responses_status_200_total',
    );
  });

  it.each([
    ['invalid', 400],
    ['unexpected', 500],
  ])('records the final status for %s', async (path, status) => {
    await request(app.getHttpServer()).get(`/${path}`).expect(status);
    expect(metrics.increment).toHaveBeenCalledWith(
      `http_responses_status_${status}_total`,
    );
  });

  it('records successful REST duration separately from streams', async () => {
    await request(app.getHttpServer()).get('/ok').expect(200);
    expect(metrics.increment).toHaveBeenCalledWith('http_rest_requests_total');
    expect(metrics.increment).toHaveBeenCalledWith(
      'http_request_duration_ms_total',
      expect.any(Number),
    );
    expect(metrics.increment).not.toHaveBeenCalledWith(
      'http_sse_connections_total',
    );
  });

  it('excludes SSE connection lifetimes from REST duration', async () => {
    await request(app.getHttpServer()).get('/events').expect(200);
    expect(metrics.increment).toHaveBeenCalledWith(
      'http_sse_connections_total',
    );
    expect(metrics.increment).not.toHaveBeenCalledWith(
      'http_rest_requests_total',
    );
    expect(
      metrics.increment.mock.calls.some(
        ([key]) => key === 'http_request_duration_ms_total',
      ),
    ).toBe(false);
  });
});
