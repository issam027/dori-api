import { BaseWorker } from './base.worker';

class TestWorker extends BaseWorker {
  execute(work: () => Promise<void>): Promise<void> {
    return this.runOnce(work);
  }
}

describe('BaseWorker', () => {
  it('ignores a concurrent execution and releases the lock afterwards', async () => {
    const worker = new TestWorker();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const work = jest.fn(() => pending);

    const first = worker.execute(work);
    await worker.execute(work);
    expect(work).toHaveBeenCalledTimes(1);

    release();
    await first;
    await worker.execute(async () => undefined);
  });

  it('releases the lock when the execution fails', async () => {
    const worker = new TestWorker();
    await expect(
      worker.execute(async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');

    const next = jest.fn(async () => undefined);
    await worker.execute(next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
