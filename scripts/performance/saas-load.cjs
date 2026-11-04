const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { performance, monitorEventLoopDelay } = require('node:perf_hooks');
const directory = path.resolve('.tmp-consolidation/saas-performance');
const fixture = JSON.parse(
  fs.readFileSync(path.join(directory, 'fixture.json')),
);
const base =
  process.env.PERF_RUNNER_NETWORK === 'docker'
    ? 'http://intra-dorify-ui-app-1:8080/api/v1/'
    : 'http://127.0.0.1:18080/api/v1/';
const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });
const samples = [];
const tokens = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function distribution(values) {
  const a = [...values].sort((a, b) => a - b);
  const at = (p) =>
    +(a[Math.max(0, Math.ceil(a.length * p) - 1)] ?? 0).toFixed(2);
  return {
    count: a.length,
    p50Ms: at(0.5),
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    maxMs: at(1),
  };
}
async function request(
  account,
  method,
  endpoint,
  body,
  label = endpoint.split('?')[0],
) {
  const started = performance.now();
  return new Promise((resolve) => {
    let finished = false;
    const done = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const r = { ...result, ms: performance.now() - started, label, method };
      samples.push({ label, method, status: r.status, code: r.code, ms: r.ms });
      resolve(r);
    };
    const bytes = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      base + endpoint,
      {
        agent,
        method,
        headers: {
          ...(tokens.has(account.username)
            ? { Authorization: 'Bearer ' + tokens.get(account.username) }
            : {}),
          ...(bytes ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (text += chunk));
        response.on('end', () => {
          let value;
          try {
            value = JSON.parse(text);
          } catch {}
          done({
            status: response.statusCode,
            data: value?.data,
            code: value?.code,
          });
        });
        response.on('error', () => done({ status: 0, code: 'response_error' }));
      },
    );
    const timer = setTimeout(() => req.destroy(new Error('deadline')), 45000);
    req.on('error', (error) =>
      done({ status: 0, code: error.code ?? error.message }),
    );
    req.end(bytes);
  });
}
async function login(account) {
  const response = await request(
    account,
    'POST',
    'auth/login',
    { username: account.username, password: account.password },
    'auth/login',
  );
  if (response.status !== 200 || !response.data?.accessToken)
    throw new Error(
      account.username +
        ' login failed ' +
        response.status +
        ' ' +
        response.code,
    );
  tokens.set(account.username, response.data.accessToken);
}
function summarize(rows) {
  const groups = {};
  for (const row of rows) {
    const key = row.method + ' ' + row.label;
    const group = (groups[key] ??= { requests: 0, statuses: {}, values: [] });
    group.requests++;
    group.statuses[row.status] = (group.statuses[row.status] ?? 0) + 1;
    group.values.push(row.ms);
  }
  return Object.fromEntries(
    Object.entries(groups).map(([key, g]) => [
      key,
      { requests: g.requests, statuses: g.statuses, ...distribution(g.values) },
    ]),
  );
}
function save(name, value) {
  fs.writeFileSync(
    path.join(directory, name + '.json'),
    JSON.stringify(value, null, 2),
  );
  console.log(name + ': ' + JSON.stringify(value));
}
const manager = fixture.accounts[1],
  admin = fixture.accounts[0];
const today = fixture.today;
const date = (offset) =>
  new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000)
    .toISOString()
    .slice(0, 10);
function reads() {
  const q = fixture.queues[0].id,
    s = fixture.site;
  return [
    ['cockpit', manager, `sites/${s}/cockpit`],
    ['next-preview', manager, `sites/${s}/next-preview`],
    ['queues', manager, `queues?siteId=${s}&page=1&pageSize=25`],
    ['persons', manager, `persons?siteId=${s}&page=1&pageSize=25`],
    [
      'persons-search',
      manager,
      `persons?siteId=${s}&page=1&pageSize=25&search=Amine`,
    ],
    ['person-detail', manager, `persons/${fixture.people[0]}`],
    ['person-notes', manager, `persons/${fixture.people[0]}/notes`],
    [
      'calendar-week',
      manager,
      `registrations?siteId=${s}&dateFrom=${date(1)}&dateTo=${date(7)}&entryType=appointment&page=1&pageSize=100`,
    ],
    [
      'calendar-month',
      manager,
      `registrations?queueId=${q}&dateFrom=${date(1)}&dateTo=${date(30)}&entryType=appointment&page=1&pageSize=100`,
    ],
    ['queue-status', manager, `queues/${q}/status`],
    ['queue-threads', manager, `queues/${q}/threads`],
    ['live-supervision', manager, `monitoring/live?siteId=${s}`],
    ['audit', manager, `audit-events?siteId=${s}&page=1&pageSize=25`],
    [
      'audit-filter',
      manager,
      `audit-events?siteId=${s}&action=queueEngine.markServed&page=1&pageSize=25`,
    ],
    ['notifications', manager, `notifications?siteId=${s}&page=1&pageSize=25`],
    ['settings-site', manager, `sites/${s}`],
    ['settings-services', manager, `queues/${q}/tiers`],
    ['users', admin, 'users?page=1&pageSize=25'],
    ['roles', admin, 'roles'],
    ['translations', admin, 'translations?page=1&pageSize=25'],
    ['health', admin, 'monitoring/health'],
    [
      'report-7d',
      manager,
      `monitoring/series?siteId=${s}&from=${date(-7)}T00:00:00Z&to=${date(1)}T00:00:00Z&bucket=day`,
    ],
    [
      'report-30d',
      manager,
      `monitoring/series?siteId=${s}&from=${date(-30)}T00:00:00Z&to=${date(1)}T00:00:00Z&bucket=day`,
    ],
    [
      'report-90d',
      manager,
      `monitoring/series?siteId=${s}&from=${date(-90)}T00:00:00Z&to=${date(1)}T00:00:00Z&bucket=week`,
    ],
    [
      'report-queue',
      manager,
      `monitoring/series?siteId=${s}&queueIds=${q}&from=${date(-30)}T00:00:00Z&to=${date(1)}T00:00:00Z&bucket=day`,
    ],
  ];
}
async function smoke() {
  await login(manager);
  await login(admin);
  const cases = [];
  for (const [name, user, url] of reads()) {
    const r = await request(user, 'GET', url, undefined, name);
    cases.push({
      name,
      status: r.status,
      code: r.code,
      ms: +r.ms.toFixed(2),
      hasData: r.data !== undefined,
    });
  }
  save('api-smoke', { cases, passed: cases.every((r) => r.status === 200) });
  if (cases.some((r) => r.status !== 200)) process.exitCode = 1;
}
async function sessions() {
  for (const account of fixture.accounts) {
    await login(account);
    if (account.role !== 'operator') continue;
    const r = await request(
      account,
      'POST',
      `queues/${account.queueId}/sessions`,
      {
        threadNumber: account.threadNumber,
        counterName: 'PERF Guichet ' + account.threadNumber,
        mode: 'active',
      },
      'open-session',
    );
    if (r.status !== 201)
      throw new Error(
        'Session ' + account.username + ' failed ' + r.status + ' ' + r.code,
      );
    account.sessionId = r.data.sessionId;
  }
  fs.writeFileSync(
    path.join(directory, 'sessions.json'),
    JSON.stringify(
      fixture.accounts
        .filter((a) => a.role === 'operator')
        .map((a) => ({
          username: a.username,
          sessionId: a.sessionId,
          queueId: a.queueId,
        })),
    ),
  );
  save('session-setup', { operators: 24, passed: true });
}
async function load() {
  await login(manager);
  await login(admin);
  const operators = fixture.accounts
    .filter((a) => a.role === 'operator')
    .filter(
      (a) =>
        !fs.existsSync(path.join(directory, 'active-staff.json')) ||
        JSON.parse(
          fs.readFileSync(path.join(directory, 'active-staff.json')),
        ).some((session) => session.user_id === a.userId),
    )
    .slice(0, 18);
  for (const op of operators) await login(op);
  const called = new Set();
  const duplicates = [];
  const phases = [];
  const scenarios = reads();
  let cursor = 0;
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  try {
    const profiles =
      process.env.PERF_STAFF_PROFILE === 'max'
        ? [{ readers: 16, operators: 18, duration: 180000 }]
        : [
            { readers: 4, operators: 2, duration: 120000 },
            { readers: 8, operators: 6, duration: 120000 },
            { readers: 16, operators: 18, duration: 180000 },
          ];
    for (const profile of profiles) {
      const started = performance.now(),
        offset = samples.length;
      let calls = 0,
        completed = 0,
        guard = false;
      loop.reset();
      const running = () =>
        performance.now() - started < profile.duration && !guard;
      const reader = async () => {
        while (running()) {
          const [label, user, url] = scenarios[cursor++ % scenarios.length];
          await request(user, 'GET', url, undefined, label);
          await sleep(800);
        }
      };
      const operator = async (account) => {
        while (running()) {
          const r = await request(
            account,
            'POST',
            `queues/${account.queueId}/next`,
            undefined,
            'call-next',
          );
          if (r.status === 200 && r.data?.registrationId) {
            const ordinal = ++calls;
            if (called.has(r.data.registrationId))
              duplicates.push(r.data.registrationId);
            called.add(r.data.registrationId);
            if (ordinal % 10 === 0)
              await request(
                account,
                'POST',
                `queue-engine/registrations/${r.data.registrationId}/recall`,
                undefined,
                'recall',
              );
            await sleep(500);
            const close = await request(
              account,
              'POST',
              `registrations/${r.data.registrationId}/${ordinal % 12 === 0 ? 'no-show' : 'served'}`,
              undefined,
              'finish-ticket',
            );
            if (close.status === 200) completed++;
          }
          await sleep(4500);
        }
      };
      const guardTimer = setInterval(() => {
        if (process.memoryUsage.rss() > 450 * 1048576) guard = true;
      }, 1000);
      try {
        await Promise.all([
          ...Array.from({ length: profile.readers }, reader),
          ...operators.slice(0, profile.operators).map(operator),
        ]);
      } finally {
        clearInterval(guardTimer);
      }
      const rows = samples.slice(offset);
      const errors = rows.filter(
        (r) => r.status < 200 || r.status >= 300,
      ).length;
      const result = {
        ...profile,
        elapsedMs: Math.round(performance.now() - started),
        requests: rows.length,
        errors,
        calls,
        completed,
        duplicateCalls: duplicates.length,
        requestsPerSecond: +(
          rows.length /
          ((performance.now() - started) / 1000)
        ).toFixed(2),
        generatorLoopP99Ms: +(loop.percentile(99) / 1e6).toFixed(2),
        generatorRssMB: Math.round(process.memoryUsage.rss() / 1048576),
        memoryGuard: guard,
        byScenario: summarize(rows),
      };
      phases.push(result);
      save('staff-load', {
        phases,
        distinctCalledTickets: called.size,
        duplicateCalls: duplicates.length,
      });
      if (
        guard ||
        errors > rows.length * 0.05 ||
        result.generatorLoopP99Ms > 100
      )
        break;
      await sleep(3000);
    }
  } finally {
    loop.disable();
  }
}
async function closeSessions() {
  const sessions = JSON.parse(
    fs.readFileSync(path.join(directory, 'sessions.json')),
  );
  for (const op of fixture.accounts.filter((a) => a.role === 'operator')) {
    await login(op);
    const session = sessions.find((s) => s.username === op.username);
    if (session?.sessionId)
      await request(
        op,
        'DELETE',
        `queues/${op.queueId}/sessions/${session.sessionId}`,
        undefined,
        'close-session',
      );
  }
  save('session-close', summarize(samples));
}
const modes = { smoke, sessions, load, close: closeSessions };
if (!modes[process.argv[2]]) throw new Error('Use smoke|sessions|load|close');
modes[process.argv[2]]()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => agent.destroy());
