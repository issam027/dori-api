import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  constructor(private readonly monitoringService: MonitoringService) {}

  use(_request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const record = () => {
      response.off('finish', record);
      response.off('close', record);
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (!response.writableFinished) {
        this.monitoringService.increment('http_aborted_requests_total');
        return;
      }
      const isSse = String(response.getHeader('content-type') ?? '').startsWith(
        'text/event-stream',
      );
      this.monitoringService.increment('http_requests_total');
      this.monitoringService.increment(
        `http_responses_status_${response.statusCode}_total`,
      );
      if (isSse) {
        this.monitoringService.increment('http_sse_connections_total');
        this.monitoringService.increment(
          'http_sse_duration_ms_total',
          elapsedMs,
        );
      } else {
        this.monitoringService.increment('http_rest_requests_total');
        this.monitoringService.increment(
          'http_request_duration_ms_total',
          elapsedMs,
        );
        this.monitoringService.increment(
          'http_rest_request_duration_ms_total',
          elapsedMs,
        );
      }
    };
    response.once('finish', record);
    response.once('close', record);
    next();
  }
}
