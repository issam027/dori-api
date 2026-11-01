import { runtimeMetrics } from './runtime-metrics';

describe('runtime metrics', () => {
  it('reports a percentile bucket and keeps metric cardinality bounded', () => {
    for (let i = 0; i < 100; i++)
      runtimeMetrics.observe('test_route', i < 96 ? 20 : 200);
    expect(runtimeMetrics.snapshot().test_route_p95_upper_ms).toBe(25);
    expect(runtimeMetrics.snapshot().test_route_count).toBe(100);
    for (let i = 0; i < 2000; i++) runtimeMetrics.set('test_gauge_' + i, i);
    for (let i = 0; i < 500; i++) runtimeMetrics.observe('test_hist_' + i, 1);
    expect(Object.keys(runtimeMetrics.snapshot()).length).toBeLessThanOrEqual(
      1024 + 256 * 3,
    );
  });
});
