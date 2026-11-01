import { runtimeMetrics } from '../core/observability/runtime-metrics';

export abstract class BaseWorker {
  private running = false;

  protected async runOnce(work: () => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    const started = performance.now();
    try {
      await work();
    } finally {
      this.running = false;
      runtimeMetrics.observe(
        'job_' + this.constructor.name,
        performance.now() - started,
      );
    }
  }
}
