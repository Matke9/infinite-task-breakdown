import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Neon (and most managed Postgres) require TLS. Enable it with DATABASE_SSL=true
// in production; local Postgres normally runs without TLS so it stays off by
// default. rejectUnauthorized:false is used because Neon's pooled endpoint can
// present a cert chain node-postgres won't verify out of the box — the
// connection is still encrypted, we just skip CA validation. See DECISIONS 009.
const sslEnabled = process.env.DATABASE_SSL === 'true';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
