/** Normalizes raw PostgreSQL UPDATE/INSERT ... RETURNING results across TypeORM paths. */
export function returningRows<T>(raw: unknown): T[] {
  const rows = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
  if (!Array.isArray(rows)) {
    throw new Error('Unexpected database RETURNING result');
  }
  return rows as T[];
}
