import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly monitoringService: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = process.hrtime.bigint();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      finalize(() => {
        const elapsedMs =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        this.monitoringService.increment('http_requests_total');
        this.monitoringService.increment(
          `http_responses_status_${response.statusCode}_total`,
        );
        this.monitoringService.increment(
          'http_request_duration_ms_total',
          elapsedMs,
        );
      }),
    );
  }
}
