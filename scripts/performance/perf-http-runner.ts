import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client, ClientConfig } from 'pg';
import { performance } from 'perf_hooks';
import { postgresClientConfig } from '../../src/core/database/postgres-connection';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ScenarioResult {
  name: string;
  requests: number;
  errors: number;
  throughputPerSecond: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

const apiBaseUrl = (
  process.env.PERF_BASE_URL ?? 'https://dori-api.vercel.app/api/v1'
).replace(/\/$/, '');
const requests = Number(process.env.PERF_REQUESTS ?? 20);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 4);
const requestTimeoutMs = Number(process.env.PERF_REQUEST_TIMEOUT_MS ?? 15000);
const p95BudgetMs = Number(process.env.PERF_P95_BUDGET_MS ?? 500);
const p99BudgetMs = Number(process.env.PERF_P99_BUDGET_MS ?? 1000);
const minThroughput = Number(process.env.PERF_MIN_RPS ?? 10);

function dbConfig(): ClientConfig {
  return postgresClientConfig();
}

function percentile(sorted: number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  ];
}

async function benchmark(
  name: string,
  url: string,
  token?: string,
): Promise<ScenarioResult> {
  const durations: number[] = [];
  let errors = 0;
  let cursor = 0;
  const startedAt = performance.now();

  async function worker(): Promise<void> {
    while (cursor < requests) {
      cursor += 1;
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        await response.arrayBuffer();
        if (!response.ok) errors += 1;
      } catch {
        errors += 1;
      }
      durations.push(performance.now() - requestStartedAt);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, requests) }, () => worker()),
  );
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  durations.sort((a, b) => a - b);

  return {
    name,
    requests,
    errors,
    throughputPerSecond: Number((requests / elapsedSeconds).toFixed(2)),
    p50Ms: Number(percentile(durations, 0.5).toFixed(2)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(2)),
    p99Ms: Number(percentile(durations, 0.99).toFixed(2)),
    maxMs: Number(durations[durations.length - 1].toFixed(2)),
  };
}

async function main(): Promise<void> {
  const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'perf01_manager',
      password: 'Perf-01-Only!',
    }),
  });
  if (!loginResponse.ok)
    throw new Error(`Login failed: ${loginResponse.status}`);
  const login = (await loginResponse.json()) as {
    data?: { accessToken?: string };
  };
  const token = login.data?.accessToken;
  if (!token) throw new Error('Login response has no access token.');

  const client = new Client(dbConfig());
  await client.connect();
  const identifiers = await client.query<{
    site_id: string;
    queue_id: string;
  }>(`
    SELECT s.site_id, MIN(q.queue_id::text)::uuid AS queue_id
    FROM dorify.dori_site s JOIN dorify.dori_queue q ON q.site_id = s.site_id
    WHERE s.site_name LIKE 'PERF-01 - %'
    GROUP BY s.site_id
  `);
  await client.end();
  if (!identifiers.rows[0]) throw new Error('PERF-01 dataset not found.');
  const { site_id: siteId, queue_id: queueId } = identifiers.rows[0];
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 60);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const query = (values: Record<string, string>) =>
    new URLSearchParams(values).toString();

  const scenarios = [
    ['health', `${apiBaseUrl}/monitoring/health`, false],
    [
      'persons-search',
      `${apiBaseUrl}/persons?${query({ siteId, search: 'Perf-', page: '1', pageSize: '50' })}`,
      true,
    ],
    [
      'registrations-list',
      `${apiBaseUrl}/registrations?${query({ siteId, dateFrom: date(from), dateTo: date(today), page: '1', pageSize: '50' })}`,
      true,
    ],
    [
      'notifications-list',
      `${apiBaseUrl}/notifications?${query({ siteId, dateFrom: date(from), dateTo: date(today), page: '1', pageSize: '50' })}`,
      true,
    ],
    [
      'monitoring-live',
      `${apiBaseUrl}/monitoring/live?${query({ siteId })}`,
      true,
    ],
    [
      'report-series',
      `${apiBaseUrl}/monitoring/series?${query({ siteId, from: `${date(from)}T00:00:00Z`, to: `${date(today)}T23:59:59Z`, bucket: 'day', timezone: 'Africa/Tunis' })}`,
      true,
    ],
    [
      'queue-sessions',
      `${apiBaseUrl}/queues/${queueId}/sessions?page=1&pageSize=50`,
      true,
    ],
  ] as const;

  const results: ScenarioResult[] = [];
  for (const [name, url, authenticated] of scenarios) {
    const result = await benchmark(
      name,
      url,
      authenticated ? token : undefined,
    );
    results.push(result);
    process.stdout.write(
      `[perf-http] ${name} p95=${result.p95Ms}ms p99=${result.p99Ms}ms rps=${result.throughputPerSecond} errors=${result.errors}\n`,
    );
  }

  const violations = results.filter(
    (result) =>
      result.errors > 0 ||
      result.p95Ms > p95BudgetMs ||
      result.p99Ms > p99BudgetMs ||
      result.throughputPerSecond < minThroughput,
  );
  const output = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    dataset: { siteId, queueId },
    configuration: {
      requests,
      concurrency,
      requestTimeoutMs,
      p95BudgetMs,
      p99BudgetMs,
      minThroughput,
    },
    results,
    passed: violations.length === 0,
    violations: violations.map((result) => result.name),
  };
  const outputDirectory = path.resolve(__dirname, '../../reports/performance');
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, 'http-latest.json'),
    `${JSON.stringify(output, null, 2)}\n`,
  );
  if (violations.length > 0) {
    throw new Error(
      `Performance budget exceeded: ${output.violations.join(', ')}`,
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[perf-http] ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
