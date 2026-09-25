import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { enablePgvectorSql, vectorSearchSql, hnswIndexSql } from './schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/openbox';

async function migrate() {
  console.log('Connecting to database...');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Enabling pgvector extension...');
  await db.execute(enablePgvectorSql);

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