export abstract class BaseWorker {
  private running = false;

  protected async runOnce(work: () => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await work();
    } finally {
      this.running = false;
    }
  }
}
