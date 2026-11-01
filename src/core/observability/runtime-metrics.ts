/** Process-local, bounded metrics. Keys must be route templates or static job names. */
class RuntimeMetrics {
  private readonly values = new Map<string, number>();
  private readonly samples = new Map<
    string,
    { count: number; sum: number; buckets: number[] }
  >();
  private readonly bounds = [
    1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 30000,
  ];
  set(name: string, value: number): void {
    if (this.values.size < 1024 || this.values.has(name))
      this.values.set(name, value);
  }
  add(name: string, value = 1): void {
    this.set(name, (this.values.get(name) ?? 0) + value);
  }
  observe(name: string, ms: number): void {
    if (!this.samples.has(name) && this.samples.size >= 256) return;
    const sample = this.samples.get(name) ?? {
      count: 0,
      sum: 0,
      buckets: this.bounds.map(() => 0),
    };
    sample.count++;
    sample.sum += ms;
    this.bounds.forEach((bound, index) => {
      if (ms <= bound) sample.buckets[index]++;
    });
    this.samples.set(name, sample);
  }
  snapshot(): Record<string, number> {
    const result = Object.fromEntries(this.values);
    for (const [name, sample] of this.samples) {
      result[name + '_count'] = sample.count;
      result[name + '_duration_ms_total'] = sample.sum;
      const index = sample.buckets.findIndex(
        (count) => count >= sample.count * 0.95,
      );
      result[name + '_p95_upper_ms'] =
        index < 0 ? Number.MAX_SAFE_INTEGER : this.bounds[index];
    }
    return result;
  }
}
export const runtimeMetrics = new RuntimeMetrics();
