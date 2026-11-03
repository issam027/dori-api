/** Connection limits apply to one database, across all declared replicas and roles. */
export function databaseRuntimeSettings(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const integer = (name: string, fallback: number, minimum = 0) => {
    const value = Number(environment[name] ?? fallback);
    if (!Number.isInteger(value) || value < minimum || value > 86_400_000)
      throw new Error(
        `${name} must be an integer between ${minimum} and 86400000`,
      );
    return value;
  };
  const maxConnections = integer('DB_MAX_CONNECTIONS', 100, 1);
  const reservedConnections = integer('DB_RESERVED_CONNECTIONS', 20);
  const apiInstances = integer('DB_API_INSTANCES', 1, 1);
  const agentInstances = integer('DB_AGENT_INSTANCES', 0);
  const agentPoolMax = integer('DB_AGENT_POOL_MAX', 3, 1);
  const workerConnections = integer('DB_WORKER_CONNECTIONS', 0);
  const available =
    maxConnections -
    reservedConnections -
    agentInstances * (agentPoolMax + 1) -
    workerConnections;
  const poolMax = integer(
    'DB_POOL_MAX',
    Math.min(10, Math.floor(available / apiInstances) - 1),
    1,
  );
  const allocatedConnections =
    apiInstances * (poolMax + 1) +
    agentInstances * (agentPoolMax + 1) +
    workerConnections +
    reservedConnections;
  if (allocatedConnections > maxConnections)
    throw new Error(
      'PostgreSQL connection budget exceeded: reduce pools/replicas or increase the verified database budget',
    );
  return {
    poolMax,
    maxConnections,
    allocatedConnections,
    reservedConnections,
    apiInstances,
    agentInstances,
    agentPoolMax,
    workerConnections,
    connectionTimeoutMs: integer('DB_CONNECTION_TIMEOUT_MS', 5000, 100),
    statementTimeoutMs: integer('DB_STATEMENT_TIMEOUT_MS', 30_000, 100),
    lockTimeoutMs: integer('DB_LOCK_TIMEOUT_MS', 3000, 100),
    idleTransactionTimeoutMs: integer(
      'DB_IDLE_TRANSACTION_TIMEOUT_MS',
      15_000,
      100,
    ),
    realtimeSafetyMs: integer('REALTIME_SAFETY_REFRESH_MS', 300_000, 60_000),
  };
}

/** LISTEN needs session affinity. Neon transaction-pooled URLs cannot supply it. */
export function databaseListenUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const url = new URL(
    environment.DATABASE_LISTEN_URL ?? environment.DATABASE_URL ?? '',
  );
  if (url.hostname.endsWith('.neon.tech'))
    url.hostname = url.hostname.replace('-pooler.', '.');
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_LISTEN_URL must be a PostgreSQL URL');
  return url.toString();
}
