/* Publish aggregates only. Private fixture credentials and raw browser captures stay local. */
const fs = require('node:fs');
const path = require('node:path');
const folder = path.resolve('.tmp-consolidation/saas-performance');
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(folder, name + '.json')));
const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) =>
    +(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0).toFixed(2);
  return {
    count: sorted.length,
    p50Ms: at(0.5),
    p95Ms: at(0.95),
    maxMs: at(1),
  };
};
const desktop = read('browser-load-firstpass');
const mobile = read('browser-mobile');
const browsers = [1440, 1024, 390].map((width) => {
  const source = width === 390 ? mobile : desktop;
  const timings = source.timings.filter((row) => row.profile === width);
  const traffic = source.network.filter((row) => row.profile === width);
  return {
    width,
    navigations: distribution(timings.map((row) => row.ms)),
    horizontalOverflows: timings.filter((row) => row.horizontalOverflow).length,
    errors: source.errors.filter((row) => row.profile === width).length,
    interactions: source.actions.filter((row) => row.profile === width).length,
    httpRequests: traffic.length,
    httpStatuses: traffic.reduce((groups, row) => {
      groups[row.status] = (groups[row.status] ?? 0) + 1;
      return groups;
    }, {}),
  };
});
const summary = {
  environment: 'Persistent local intra; cloud and agent stopped',
  data: read('data-verification'),
  restoredConfigurationSmoke: read('api-smoke'),
  beforeCockpitFix: read('staff-load-before-cockpit-fix'),
  afterCockpitFix: read('staff-load'),
  browsers,
  visualChecks: read('visual-checks').map((row) => ({
    name:
      row.name === 'browser-call-next-and-served'
        ? 'browser-call-next-and-open-outcome-confirmation'
        : row.name,
    passed: row.passed,
  })),
  sessionClosure: read('session-close'),
  caveats: [
    'Closed-loop staff journeys with think time; not a fixed arrival-rate benchmark.',
    'Browser navigation timings include a 400 ms stability check.',
    'Initial anonymous auth refresh 401 responses are expected.',
    'Desktop/tablet retained from first pass; mobile replayed after fixing test menu navigation.',
    'One browser-called ticket was closed separately through the real API after opening the confirmation dialog.',
    'Synthetic history and accelerated service times are not real operational statistics.',
  ],
};
const output = path.resolve('reports/performance/saas-100k-2026-11-04.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ browsers, output }, null, 2));
