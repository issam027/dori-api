const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
if (!fs.existsSync('compose.performance.yaml'))
  throw new Error('Run from the dori-api repository root');
const directory = path.resolve('.tmp-consolidation/performance');
fs.mkdirSync(directory, { recursive: true });
const file = path.join(directory, 'identity.json');
const identity = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : {
      jwt: crypto.randomBytes(32).toString('hex'),
      installationId: crypto.randomUUID(),
      cloudToken: crypto.randomBytes(32).toString('hex'),
    };
fs.writeFileSync(file, JSON.stringify(identity));
const capacity = process.argv.includes('--capacity');
fs.writeFileSync(
  path.join(directory, 'runtime.env'),
  `PERF_JWT_SECRET=${identity.jwt}\nPERF_INSTALLATION_ID=${identity.installationId}\nPERF_CLOUD_TOKEN=${identity.cloudToken}\n` +
    (capacity ? 'PERF_RATE_LIMIT=100000\n' : ''),
);
console.log(
  'Private isolated performance configuration prepared: ' +
    (capacity ? 'capacity profile' : 'unchanged rate-limit profile'),
);
