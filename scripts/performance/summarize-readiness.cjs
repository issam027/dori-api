/* Export only allowlisted observations; never copy fixture credentials. */
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve('.tmp-consolidation/performance');
const names = [
  'default-protection',
  'booking-contention',
  'sse-ramp',
  'mixed-soak',
  'cloud-fanout',
  'cloud-outage',
  'network-partition',
];
const observations = {};
for (const name of names) {
  const file = path.join(directory, name + '.json');
  observations[name] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { notCompleted: true };
}
function memoryMiB(text) {
  const match = text.match(/^([\d.]+)([KMGT]?i?B)/);
  if (!match) return 0;
  const factors = {
    B: 1 / 1048576,
    kB: 1 / 1024,
    KiB: 1 / 1024,
    MB: 1,
    MiB: 1,
    GB: 1024,
    GiB: 1024,
  };
  return Number(match[1]) * (factors[match[2]] ?? 0);
}
const resources = {};
const samples = path.join(directory, 'resources.ndjson');
if (fs.existsSync(samples))
  for (const line of fs.readFileSync(samples, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (!row.Name.startsWith('dorify-perf-')) continue;
    const peak = (resources[row.Name] ??= {
      samples: 0,
      cpuPercentMax: 0,
      memoryMiBMax: 0,
    });
    peak.samples++;
    peak.cpuPercentMax = Math.max(peak.cpuPercentMax, parseFloat(row.CPUPerc));
    peak.memoryMiBMax = +Math.max(
      peak.memoryMiBMax,
      memoryMiB(row.MemUsage),
    ).toFixed(2);
  }
const result = {
  generatedAt: new Date().toISOString(),
  scope:
    'Isolated local Docker, one API per role, HTTP through nginx; not production certification',
  caveats: [
    'Capacity phases override rate limits only on the isolated bench.',
    'passed means functional invariants, not latency SLA.',
    'Postman run aborted by host memory protection; not a completed capacity result.',
    'Three-minute mixed run is not a long-duration soak.',
  ],
  observations,
  sampledResources: resources,
};
fs.mkdirSync('reports/performance', { recursive: true });
const destination = 'reports/performance/readiness-2026-11-03.json';
fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
console.log('Sanitized observations exported to ' + destination);
