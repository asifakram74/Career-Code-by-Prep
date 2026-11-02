import fs from 'fs';
import path from 'path';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema';
import { config } from '../config';

export type Database = NodePgDatabase<typeof schema>;

const migrationsFolder = path.resolve(config.rootDir, 'server/db/migrations');

let pool: pg.Pool | null = null;

// Uses DATABASE_URL when set (production, or a local Postgres). Without it, an
// embedded PGlite database is stored in PGLITE_DIR so development needs no install.
async function connect(): Promise<Database> {
  if (config.databaseUrl) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
    const database = drizzlePg(pool, { schema });
    await migratePg(database, { migrationsFolder });
    return database;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  fs.mkdirSync(path.dirname(config.pgliteDir), { recursive: true });
  const client = new PGlite(config.pgliteDir);
  const database = drizzlePglite(client, { schema });
  await migratePglite(database, { migrationsFolder });
  console.warn(`DATABASE_URL not set; using embedded PGlite database at ${config.pgliteDir}`);
  // Both drivers share the PgDatabase query API.
  return database as unknown as Database;
}

export const db: Database = await connect();

export async function closeDb() {
  await pool?.end();
}

export * as t from './schema';
