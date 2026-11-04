const fs = require('node:fs');
const { execFile } = require('node:child_process');
const directory =
  process.env.PERF_RESOURCE_DIRECTORY ?? '.tmp-consolidation/performance';
const prefix = process.env.PERF_CONTAINER_PREFIX ?? 'dorify-perf-';
const output = directory + '/resources.ndjson';
fs.writeFileSync(directory + '/sampler.pid', String(process.pid));
const until = Date.now() + 20 * 60 * 1000;
function sample() {
  execFile(
    'docker',
    ['stats', '--no-stream', '--format', '{{json .}}'],
    { timeout: 10000 },
    (error, text) => {
      if (!error)
        for (const line of text.trim().split('\n')) {
          try {
            const row = JSON.parse(line);
            if (row.Name.startsWith(prefix))
              fs.appendFileSync(
                output,
                JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n',
              );
          } catch {}
        }
      if (Date.now() < until) setTimeout(sample, 3000);
    },
  );
}
sample();
