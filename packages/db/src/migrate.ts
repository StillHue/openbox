import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate as drizzleMigrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enablePgvectorSql, vectorSearchSql, hnswIndexSql } from './schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/openbox';

// Resolve relative to this file so it works regardless of CWD
// (src/migrate.ts -> ../migrations, dist/migrate.js -> ../migrations).
const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

async function migrate() {
  console.log('Connecting to database...');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Enabling pgvector extension...');
  await db.execute(enablePgvectorSql);

  console.log('Applying table migrations from', migrationsFolder);
  await drizzleMigrate(db, { migrationsFolder });

  console.log('Creating vector search function...');
  await db.execute(vectorSearchSql);

  console.log('Creating HNSW index...');
  await db.execute(hnswIndexSql);

  console.log('Migration completed successfully!');
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
