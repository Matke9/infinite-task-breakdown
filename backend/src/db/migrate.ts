import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool, withTransaction } from './index';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM migrations',
  );
  return new Set(result.rows.map((row) => row.filename));
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip (already applied): ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [file],
      );
    });

    console.log(`applied: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      console.log('migrations complete');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err: unknown) => {
      console.error('migration failed:', err);
      await pool.end();
      process.exit(1);
    });
}
