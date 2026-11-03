/* Real HTTP/SSE load against compose.performance.yaml only. Never reads DATABASE_URL. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { performance, monitorEventLoopDelay } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const assert = require('node:assert/strict');
const directory = path.resolve('.tmp-consolidation/performance');
const fixture = JSON.parse(
  fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8'),
);
const dockerRunner = process.env.PERF_RUNNER_NETWORK === 'docker';
const base = dockerRunner
  ? {
      intra: 'http://intra-ui:8080/api/v1/',
      cloud: 'http://cloud-ui:8080/api/v1/',
    }
  : {
      intra: 'http://127.0.0.1:28080/api/v1/',
      cloud: 'http://127.0.0.1:48080/api/v1/',
    };
const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
const tokens = {};
const generatorMemoryMB = Number(process.env.PERF_GENERATOR_MAX_RSS_MB ?? 230);
if (
  !Number.isFinite(generatorMemoryMB) ||
  generatorMemoryMB < 128 ||
  generatorMemoryMB > 460
)
  throw new Error('Generator RSS guard must be between 128 and 460 MiB');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const db = (kind) =>
  new Client({
    connectionString: dockerRunner
      ? `postgresql://perf:perf_local_only@${kind}-db:5432/dorify_perf`
      : `postgresql://perf:perf_local_only@127.0.0.1:${kind === 'intra' ? 25432 : 65432}/dorify_perf`,
  });
const composeArgs = [
  'compose',
  '--env-file',
  '.tmp-consolidation/performance/runtime.env',
  '-f',
  'compose.performance.yaml',
];
function compose(...args) {
  return execFileSync('docker', [...composeArgs, ...args], {
    stdio: 'pipe',
    timeout: 90000,
  }).toString();
}
function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (ratio) =>
    sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
  return {
    count: values.length,
    p50Ms: +at(0.5).toFixed(2),
    p95Ms: +at(0.95).toFixed(2),
    p99Ms: +at(0.99).toFixed(2),
    maxMs: +(sorted.at(-1) ?? 0).toFixed(2),
  };
}
function counterDelta(after, before, name) {
  return typeof after[name] === 'number'
    ? after[name] - (before[name] ?? 0)
    : null;
}
async function request(kind, endpoint, options = {}) {
  const started = performance.now();
  return new Promise((resolve) => {
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      base[kind] + endpoint,
      {
        agent,
        method: body ? 'POST' : 'GET',
        headers: {
          ...(tokens[kind] ? { Authorization: 'Bearer ' + tokens[kind] } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (data) => {
          text += data;
        });
        response.on('end', () => {
          let json;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({
            status: response.statusCode,
            data: json?.data,
            code: json?.code,
            ms: performance.now() - started,
          });
        });
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.on('error', (error) =>
      resolve({
        status: 0,
        error: error.code ?? error.message,
        ms: performance.now() - started,
      }),
    );
    req.end(body);
  });
}
async function login() {
  for (const kind of ['intra', 'cloud']) {
    const result = await request(kind, 'auth/login', {
      body: { username: 'root', password: fixture[kind].password },
    });
    assert.equal(result.status, 200, kind + ' login: ' + result.code);
    tokens[kind] = result.data.accessToken;
  }
}
async function metrics(kind) {
  const result = await request(kind, 'monitoring/metrics');
  assert.equal(result.status, 200, 'metrics');
  return result.data.counters;
}
async function workers(count, concurrency, action) {
  let cursor = 0;
  const results = [];
  await Promise.all(
    Array.from({ length: Math.min(count, concurrency) }, async () => {
      while (cursor < count) {
        const index = cursor++;
        results[index] = await action(index);
      }
    }),
  );
  return results;
}
class Stream {
  constructor(kind, ticket, onEvent) {
    this.kind = kind;
    this.ticket = ticket;
    this.onEvent = onEvent;
    this.opened = false;
    this.heartbeats = 0;
    this.errors = {};
    this.stopped = false;
    this.started = performance.now();
    this.connect();
  }
  connect() {
    if (this.stopped) return;
    this.connected = false;
    const endpoint =
      this.kind === 'cloud'
        ? 'realtime/tracking'
        : 'realtime/queues/' + fixture.intra.queues.live + '/tracking';
    this.req = http.get(
      base[this.kind] + endpoint,
      {
        agent,
        headers: {
          Accept: 'text/event-stream',
          'X-Registration-Token': this.ticket.registration_tracking_token,
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          this.errors[response.statusCode] =
            (this.errors[response.statusCode] ?? 0) + 1;
          response.resume();
          this.retry();
          return;
        }
        this.opened = true;
        this.connected = true;
        this.openMs ??= performance.now() - this.started;
        let pending = '';
        response.setEncoding('utf8');
        response.on('data', (data) => {
          pending += data;
          let boundary;
          while ((boundary = pending.indexOf('\n\n')) >= 0) {
            const frame = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            const type = frame.match(/^event:\s*(.+)$/m)?.[1],
              raw = frame.match(/^data:\s*(.+)$/m)?.[1];
            if (!raw || !type) continue;
            let value;
            try {
              value = JSON.parse(raw);
            } catch {
              continue;
            }
            if (type === 'heartbeat') {
              this.heartbeats++;
              this.lastHeartbeat = Date.now();
            } else {
              this.latest = value;
              this.onEvent?.(this, type, value);
            }
          }
        });
        response.on('error', () => {
          this.connected = false;
          this.retry();
        });
        response.on('close', () => {
          this.connected = false;
          this.retry();
        });
      },
    );
    this.req.on('error', (error) => {
      this.connected = false;
      this.errors[error.code ?? 'connection'] =
        (this.errors[error.code ?? 'connection'] ?? 0) + 1;
      this.retry();
    });
  }
  retry() {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.connect();
    }, 1000);
  }
  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.req?.destroy();
  }
}
async function until(predicate, timeout, name) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > end) throw new Error('Timeout: ' + name);
    await sleep(100);
  }
}
function save(name, result) {
  fs.writeFileSync(
    path.join(directory, name + '.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(name + ': ' + JSON.stringify(result));
}
async function protection() {
  await login();
  const results = await workers(120, 8, () =>
    request('intra', 'queues/' + fixture.intra.queues.booking + '/status'),
  );
  const statuses = {};
  results.forEach((result) => {
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
  });
  save('default-protection', {
    requests: results.length,
    statuses,
    ...distribution(results.map((r) => r.ms)),
    defaultLimitsUnchanged: true,
  });
}
async function bookings() {
  await login();
  const records = await workers(50, 20, (index) =>
    request('intra', 'registrations', {
      body: {
        queueId: fixture.intra.queues.contended,
        personId: fixture.intra.people[index],
        tierId: fixture.intra.tierId,
        entryType: 'appointment',
        scheduledTime: fixture.intra.tomorrow + 'T09:00:00+01:00',
      },
    }),
  );
  const statuses = {},
    codes = {};
  records.forEach((r) => {
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    codes[r.code] = (codes[r.code] ?? 0) + 1;
  });
  const connection = db('intra');
  await connection.connect();
  const invariant = (
    await connection.query(
      'SELECT count(*)::int AS bookings,count(DISTINCT ticket_number)::int AS distinct_tickets FROM dorify.dori_registration WHERE queue_id=$1',
      [fixture.intra.queues.contended],
    )
  ).rows[0];
  await connection.end();
  save('booking-contention', {
    concurrency: 20,
    requests: records.length,
    capacity: 5,
    statuses,
    codes,
    ...distribution(records.map((r) => r.ms)),
    invariant,
    passed:
      invariant.bookings === 5 &&
      invariant.distinct_tickets === 5 &&
      records.every((r) => [201, 409].includes(r.status)),
  });
}
async function sse() {
  await login();
  const refetchEnabled = process.env.PERF_SSE_REFETCH !== 'false';
  const connection = db('intra');
  await connection.connect();
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const results = [];
  try {
    const targets = (process.env.PERF_SSE_TARGETS ?? '100,500,1000,2000')
      .split(',')
      .map(Number);
    if (
      !targets.length ||
      targets.some(
        (target) =>
          ![100, 500, 1000, 2000, 4000, 6000, 8000].includes(target) ||
          target > fixture.intra.registrations.length,
      )
    )
      throw new Error('PERF_SSE_TARGETS must select supported load stages');
    for (const target of targets) {
      const streams = [],
        refetches = [],
        latency = [];
      let trigger;
      try {
        for (let index = 0; index < target; index++) {
          const kind = index % 2 ? 'intra' : 'cloud';
          streams.push(
            new Stream(
              kind,
              fixture.intra.registrations[index],
              (client, type, value) => {
                if (
                  trigger &&
                  type === 'queue_position_changed' &&
                  value.nonce === trigger.nonce &&
                  !client.delivered
                ) {
                  client.delivered = true;
                  latency.push(performance.now() - trigger.start);
                  if (refetchEnabled) {
                    refetches.push(
                      request('intra', 'public/registrations/position', {
                        headers: {
                          'X-Registration-Token':
                            client.ticket.registration_tracking_token,
                        },
                      }),
                    );
                  }
                }
              },
            ),
          );
          if ((index + 1) % 50 === 0) {
            if (process.memoryUsage().rss > (generatorMemoryMB - 10) * 1048576)
              throw new Error('Generator memory guard');
            await sleep(100);
          }
        }
        await until(
          () => streams.every((s) => s.connected),
          90000,
          'SSE ' + target + ' open',
        );
        await until(
          () => streams.every((s) => s.heartbeats > 0),
          25000,
          'SSE heartbeat ' + target,
        );
        const idleBefore = {
          intra: await metrics('intra'),
          cloud: await metrics('cloud'),
        };
        await sleep(16000);
        const idleAfter = {
          intra: await metrics('intra'),
          cloud: await metrics('cloud'),
        };
        trigger = { nonce: randomUUID(), start: performance.now() };
        await connection.query(
          `WITH event AS (INSERT INTO dorify.dori_realtime_outbox(queue_id,event_type,payload,created_at,published_at) VALUES ($1,'queue_position_changed',jsonb_build_object('queueId',$1::uuid,'timestamp',CURRENT_TIMESTAMP,'nonce',$2::text),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING event_id)
          INSERT INTO dorify.dori_realtime_topic_state(queue_id,event_type,version,event_id,updated_at) SELECT $1::uuid,'queue_position_changed',1,event_id,CURRENT_TIMESTAMP FROM event ON CONFLICT(queue_id,event_type) DO UPDATE SET version=dorify.dori_realtime_topic_state.version+1,event_id=EXCLUDED.event_id,updated_at=CURRENT_TIMESTAMP`,
          [fixture.intra.queues.live, trigger.nonce],
        );
        await until(
          () => latency.length === target / 2,
          30000,
          'fanout ' + target,
        );
        const snapshots = await Promise.all(refetches);
        let metricsUnavailable = false;
        const afterBurst = await metrics('intra').catch(() => {
          metricsUnavailable = true;
          return {};
        });
        const failures = snapshots.filter((r) => r.status !== 200).length;
        const resource = dockerRunner
          ? 'Recorded by the external Docker sampler'
          : execFileSync(
              'docker',
              [
                'stats',
                '--no-stream',
                '--format',
                '{{.Name}} {{.CPUPerc}} {{.MemUsage}}',
                'dorify-perf-intra-api-1',
                'dorify-perf-cloud-api-1',
                'dorify-perf-intra-db-1',
                'dorify-perf-cloud-db-1',
              ],
              { encoding: 'utf8' },
            ).trim();
        if (process.memoryUsage().rss > generatorMemoryMB * 1048576)
          throw new Error('Load generator exceeded its RSS memory guard');
        const result = {
          target,
          snapshotMode: refetchEnabled
            ? 'REST after SSE invalidation'
            : 'transport only, no REST refetch',
          opened: streams.filter((s) => s.opened).length,
          heartbeatClients: streams.filter((s) => s.heartbeats > 0).length,
          openLatency: distribution(streams.map((s) => s.openMs)),
          eventLatency: distribution(latency),
          browserSnapshotReads: distribution(snapshots.map((r) => r.ms)),
          snapshotFailures: failures,
          metricsUnavailable,
          successfulSnapshotReads: distribution(
            snapshots
              .filter((record) => record.status === 200)
              .map((record) => record.ms),
          ),
          snapshotClientErrors: snapshots
            .filter((record) => record.status === 0)
            .reduce((counts, record) => {
              const name = record.error ?? 'unknown';
              counts[name] = (counts[name] ?? 0) + 1;
              return counts;
            }, {}),
          snapshotApiCodes: snapshots.reduce((counts, record) => {
            const name = record.code ?? 'unavailable';
            counts[name] = (counts[name] ?? 0) + 1;
            return counts;
          }, {}),
          snapshotStatuses: snapshots.reduce((counts, item) => {
            counts[item.status] = (counts[item.status] ?? 0) + 1;
            return counts;
          }, {}),
          connected: streams.filter((s) => s.connected).length,
          freshHeartbeatClients: streams.filter(
            (s) => Date.now() - (s.lastHeartbeat ?? 0) < 45000,
          ).length,
          estimateSqlQueries: counterDelta(
            afterBurst,
            idleAfter.intra,
            'queueTicketEstimateQueriesTotal',
          ),
          estimatedTickets: counterDelta(
            afterBurst,
            idleAfter.intra,
            'queueTicketEstimateTicketsTotal',
          ),
          idle16sTopicReads:
            (idleAfter.intra.sseTopicReadsTotal ?? 0) -
            (idleBefore.intra.sseTopicReadsTotal ?? 0),
          idle16sReplicatedReads:
            (idleAfter.cloud.sseReplicatedTrackingReadsTotal ?? 0) -
            (idleBefore.cloud.sseReplicatedTrackingReadsTotal ?? 0),
          generatorLoopP99Ms: +(loop.percentile(99) / 1e6).toFixed(2),
          generatorRssMB: Math.round(process.memoryUsage().rss / 1048576),
          resources: resource,
          passed: failures === 0 && latency.length === target / 2,
          latencyThresholdPassed:
            !refetchEnabled ||
            distribution(snapshots.map((record) => record.ms)).p95Ms < 10000,
        };
        if (!result.passed || !result.latencyThresholdPassed)
          process.exitCode = 1;
        results.push(result);
        save('sse-ramp', results);
        if (failures > target * 0.05) break;
      } catch (error) {
        results.push({
          target,
          opened: streams.filter((s) => s.opened).length,
          heartbeatClients: streams.filter((s) => s.heartbeats > 0).length,
          errors: streams.reduce((counts, client) => {
            for (const [code, count] of Object.entries(client.errors))
              counts[code] = (counts[code] ?? 0) + count;
            return counts;
          }, {}),
          failure: error.message,
          passed: false,
        });
        save('sse-ramp', results);
        process.exitCode = 1;
        break;
      } finally {
        streams.forEach((s) => s.close());
        await sleep(2000);
      }
    }
  } finally {
    loop.disable();
    await connection.end();
  }
}
async function sustained() {
  await login();
  const streams = [],
    results = [];
  const rates = (process.env.PERF_RATES ?? '20,50,100,200')
    .split(',')
    .map(Number);
  if (rates.some((rate) => ![20, 50, 100, 200].includes(rate)))
    throw new Error('Unsupported arrival rate');
  const duration = Number(process.env.PERF_STAGE_MS ?? 60000);
  if (!Number.isFinite(duration) || duration < 10000 || duration > 300000)
    throw new Error('Invalid stage duration');
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  try {
    for (let index = 0; index < 2000; index++) {
      streams.push(
        new Stream(
          index % 2 ? 'intra' : 'cloud',
          fixture.intra.registrations[index],
        ),
      );
      if ((index + 1) % 50 === 0) await sleep(100);
    }
    await until(
      () =>
        streams.every((stream) => stream.connected && stream.heartbeats > 0),
      90000,
      'sustained SSE ready',
    );
    for (const rate of rates) {
      const pending = new Set(),
        records = [];
      let arrivals = 0,
        dropped = 0,
        guardHit = false;
      loop.reset();
      const before = await metrics('intra');
      const started = performance.now();
      while (performance.now() - started < duration) {
        const due = Math.min(
          Math.floor(((performance.now() - started) * rate) / 1000),
          Math.floor((duration * rate) / 1000),
        );
        while (arrivals < due) {
          const ticket =
            fixture.intra.registrations[
              arrivals++ % fixture.intra.registrations.length
            ];
          if (pending.size >= 256) {
            dropped++;
            continue;
          }
          const work = request('intra', 'public/registrations/position', {
            headers: {
              'X-Registration-Token': ticket.registration_tracking_token,
            },
          })
            .then((record) =>
              records.push({ ...record, completedAt: performance.now() }),
            )
            .finally(() => pending.delete(work));
          pending.add(work);
        }
        if (process.memoryUsage.rss() > generatorMemoryMB * 1048576) {
          guardHit = true;
          break;
        }
        await sleep(10);
      }
      const windowEnd = performance.now();
      await Promise.all([...pending]);
      const after = await metrics('intra');
      const statuses = {};
      records.forEach((record) => {
        statuses[record.status] = (statuses[record.status] ?? 0) + 1;
      });
      const errors = records.filter((record) => record.status !== 200).length;
      const latency = distribution(records.map((record) => record.ms));
      const result = {
        targetRps: rate,
        plannedWindowMs: duration,
        actualWindowMs: +(windowEnd - started).toFixed(2),
        arrivals,
        completed: records.length,
        achievedRps: +(
          records.filter((record) => record.completedAt <= windowEnd).length /
          ((windowEnd - started) / 1000)
        ).toFixed(2),
        drainMs: +(performance.now() - windowEnd).toFixed(2),
        droppedAtConcurrencyCap: dropped,
        statuses,
        errors,
        latency,
        estimateSqlQueries:
          (after.queueTicketEstimateQueriesTotal ?? 0) -
          (before.queueTicketEstimateQueriesTotal ?? 0),
        estimatedTickets:
          (after.queueTicketEstimateTicketsTotal ?? 0) -
          (before.queueTicketEstimateTicketsTotal ?? 0),
        connectedSse: streams.filter((stream) => stream.connected).length,
        freshHeartbeatClients: streams.filter(
          (stream) => Date.now() - (stream.lastHeartbeat ?? 0) < 45000,
        ).length,
        generatorLoopP99Ms: +(loop.percentile(99) / 1e6).toFixed(2),
        generatorRssMB: Math.round(process.memoryUsage.rss() / 1048576),
        generatorMemoryGuard: guardHit,
        passed:
          !guardHit &&
          dropped === 0 &&
          errors === 0 &&
          streams.every((stream) => stream.connected),
        latencyThresholdPassed: latency.p95Ms < 5000,
      };
      results.push(result);
      save('sustained-position', results);
      if (!result.passed || !result.latencyThresholdPassed)
        process.exitCode = 1;
      if (
        guardHit ||
        dropped > 0 ||
        errors > records.length * 0.01 ||
        latency.p95Ms > 5000 ||
        result.generatorLoopP99Ms > 100
      )
        break;
      await sleep(2000);
    }
  } finally {
    loop.disable();
    streams.forEach((stream) => stream.close());
  }
}
async function mixed() {
  await login();
  const requests = [],
    streams = [];
  for (let i = 0; i < 1000; i++) {
    streams.push(
      new Stream(i % 2 ? 'intra' : 'cloud', fixture.intra.registrations[i]),
    );
    if (i % 50 === 0) await sleep(100);
  }
  try {
    await until(() => streams.every((s) => s.opened), 45000, 'mixed streams');
    const started = Date.now();
    let index = 0;
    const durationMs = Number(process.env.PERF_SOAK_MS ?? 180000);
    while (Date.now() - started < durationMs) {
      const batchStart = Date.now();
      const batch = await workers(10, 10, (offset) => {
        const current = index++;
        if (current % 10 === 0)
          return request(
            'intra',
            'monitoring/series?siteId=' +
              fixture.intra.site +
              '&from=' +
              new Date(
                Date.parse(fixture.intra.today + 'T00:00:00Z') - 90 * 86400000,
              )
                .toISOString()
                .slice(0, 10) +
              'T00:00:00Z&to=' +
              fixture.intra.tomorrow +
              'T00:00:00Z&bucket=day',
          );
        if (current % 10 === 1)
          return request('intra', 'registrations', {
            body: {
              queueId: fixture.intra.queues.booking,
              personId:
                fixture.intra.people[1000 + (Math.floor(current / 10) % 1900)],
              tierId: fixture.intra.tierId,
              entryType: 'appointment',
              scheduledTime: fixture.intra.tomorrow + 'T10:00:00+01:00',
            },
          });
        return request(
          'intra',
          offset % 2
            ? 'monitoring/live?siteId=' + fixture.intra.site
            : 'queues/' + fixture.intra.queues.live + '/status',
        );
      });
      requests.push(...batch);
      await sleep(Math.max(0, 1000 - (Date.now() - batchStart)));
    }
    const statuses = {};
    requests.forEach((r) => {
      statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    });
    save('mixed-soak', {
      durationMs: Date.now() - started,
      simultaneousSse: streams.filter((s) => s.opened).length,
      heartbeatClients: streams.filter((s) => s.heartbeats > 0).length,
      requests: requests.length,
      statuses,
      latency: distribution(requests.map((r) => r.ms)),
      passed: requests.every((r) => [200, 201].includes(r.status)),
    });
  } finally {
    streams.forEach((s) => s.close());
  }
}
async function outage() {
  await login();
  const connection = db('intra');
  await connection.connect();
  const count = 1000;
  const ticket = fixture.intra.registrations[0];
  const stream = new Stream('cloud', ticket);
  const networkFault = process.env.PERF_OUTAGE_KIND === 'link';
  const resultName = networkFault ? 'network-partition' : 'cloud-outage';
  let stoppedCloud = false;
  try {
    await until(
      () => stream.latest?.languagePreference === 'fr',
      20000,
      'initial cloud snapshot',
    );
    if (networkFault)
      execFileSync('docker', [
        'network',
        'disconnect',
        'dorify-perf_cloud',
        'dorify-perf-agent-1',
      ]);
    else compose('stop', 'cloud-api');
    stoppedCloud = true;
    const cutoff = Date.now();
    await connection.query(
      "UPDATE dorify.dori_registration SET language_preference='en' WHERE registration_id=ANY($1::uuid[])",
      [
        fixture.intra.registrations
          .slice(0, count)
          .map((r) => r.registration_id),
      ],
    );
    const local = await request('intra', 'public/registrations/position', {
      headers: { 'X-Registration-Token': ticket.registration_tracking_token },
    });
    assert.equal(local.status, 200);
    assert.equal(local.data.languagePreference, 'en');
    await sleep(networkFault ? 130000 : 35000);
    const offlineDuringPartition = networkFault
      ? stream.latest?.sourceConnectivity === 'offline'
      : undefined;
    const backlog = (
      await connection.query(
        'SELECT count(*)::int AS pending FROM dorify.dori_public_tracking_state WHERE sequence>cloud_synced_sequence',
      )
    ).rows[0].pending;
    const restoredAt = Date.now();
    if (networkFault)
      execFileSync('docker', [
        'network',
        'connect',
        'dorify-perf_cloud',
        'dorify-perf-agent-1',
      ]);
    else compose('start', 'cloud-api');
    stoppedCloud = false;
    const cloudDb = db('cloud');
    await cloudDb.connect();
    let synchronized = 0;
    try {
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        synchronized = (
          await cloudDb.query(
            "SELECT count(*)::int AS count FROM dorify.dori_public_tracking_state WHERE language_preference='en'",
          )
        ).rows[0].count;
        if (synchronized >= count && stream.latest?.languagePreference === 'en')
          break;
        await sleep(1000);
      }
    } finally {
      await cloudDb.end();
    }
    save(resultName, {
      fault: networkFault
        ? 'agent/cloud network partition'
        : 'cloud API stopped',
      offlineDuringPartition,
      outageMs: restoredAt - cutoff,
      backlogAtRestart: backlog,
      changedTickets: count,
      synchronized,
      recoveryMs: Date.now() - restoredAt,
      localTrackingAvailable: local.status === 200,
      reconnectedCloudSse: stream.latest?.languagePreference === 'en',
      passed:
        synchronized >= count &&
        stream.latest?.languagePreference === 'en' &&
        (!networkFault || offlineDuringPartition === true),
    });
  } finally {
    if (stoppedCloud) {
      if (networkFault)
        execFileSync('docker', [
          'network',
          'connect',
          'dorify-perf_cloud',
          'dorify-perf-agent-1',
        ]);
      else compose('start', 'cloud-api');
    }
    stream.close();
    await connection.query(
      "UPDATE dorify.dori_registration SET language_preference='fr' WHERE registration_id=ANY($1::uuid[])",
      [
        fixture.intra.registrations
          .slice(0, count)
          .map((row) => row.registration_id),
      ],
    );
    await connection.end();
  }
}
async function cloudFanout() {
  await login();
  const source = db('intra'),
    target = db('cloud');
  await source.connect();
  await target.connect();
  const streams = [],
    durations = [];
  let started = 0;
  const ids = fixture.intra.registrations.map((row) => row.registration_id);
  try {
    for (let index = 0; index < 2000; index++) {
      streams.push(
        new Stream(
          'cloud',
          fixture.intra.registrations[index],
          (_stream, type, value) => {
            if (
              started &&
              type === 'tracking_changed' &&
              value.languagePreference === 'en' &&
              !_stream.delivered
            ) {
              _stream.delivered = true;
              durations.push(performance.now() - started);
            }
          },
        ),
      );
      if (index % 50 === 0) await sleep(100);
    }
    await until(
      () => streams.every((stream) => stream.heartbeats > 0),
      60000,
      'cloud-only heartbeat',
    );
    started = performance.now();
    await source.query(
      "UPDATE dorify.dori_registration SET language_preference='en' WHERE registration_id=ANY($1::uuid[])",
      [ids],
    );
    await until(
      () =>
        streams.every((stream) => stream.latest?.languagePreference === 'en'),
      60000,
      'cloud projection fanout',
    );
    save('cloud-fanout', {
      clients: 2000,
      updated: streams.filter(
        (stream) => stream.latest?.languagePreference === 'en',
      ).length,
      propagation: distribution(durations),
      generatorRssMB: Math.round(process.memoryUsage().rss / 1048576),
      passed: streams.every(
        (stream) => stream.latest?.languagePreference === 'en',
      ),
    });
  } finally {
    streams.forEach((stream) => stream.close());
    await source.query(
      "UPDATE dorify.dori_registration SET language_preference='fr' WHERE registration_id=ANY($1::uuid[])",
      [ids],
    );
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const restored = (
        await target.query(
          "SELECT count(*)::int AS count FROM dorify.dori_public_tracking_state WHERE source_registration_id=ANY($1::uuid[]) AND language_preference='fr'",
          [ids],
        )
      ).rows[0].count;
      if (restored === ids.length) break;
      await sleep(1000);
    }
    await Promise.all([source.end(), target.end()]);
  }
}
async function exportPostmanEnvironment() {
  await login();
  fs.writeFileSync(
    path.join(directory, 'postman.environment.json'),
    JSON.stringify({
      name: 'Isolated performance',
      values: Object.entries({
        baseUrl: base.intra.replace(/\/$/, ''),
        token: tokens.intra,
        siteId: fixture.intra.site,
        queueId: fixture.intra.queues.live,
      }).map(([key, value]) => ({ key, value, enabled: true })),
    }),
  );
  console.log('Private local Postman environment prepared');
}
const modes = {
  protection,
  bookings,
  sse,
  sustained,
  mixed,
  outage,
  cloudFanout,
  environment: exportPostmanEnvironment,
};
if (!modes[process.argv[2]])
  throw new Error(
    'Use protection|bookings|sse|sustained|mixed|outage|cloudFanout|environment',
  );
modes[process.argv[2]]()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => agent.destroy());
