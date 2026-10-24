import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import {
  enablePgvectorSql,
  vectorSearchSql,
  hnswIndexSql,
} from "./schema.js";

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
}

export function createDbClient(config: DatabaseConfig) {
  const client = postgres(config.connectionString, {
    max: config.maxConnections ?? 10,
    prepare: false,
  });

  const db = drizzle(client);

  return { db, client, close: () => client.end() };
}

export async function ensureLightragColumns(db: ReturnType<typeof drizzle>) {
  await db.execute(sql`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS box_id uuid REFERENCES boxes(id) ON DELETE CASCADE`);
  await db.execute(sql`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS embedding text`);
  await db.execute(sql`ALTER TABLE edges ADD COLUMN IF NOT EXISTS box_id uuid REFERENCES boxes(id) ON DELETE CASCADE`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS nodes_box_id_idx ON nodes (box_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS edges_box_id_idx ON edges (box_id)`);
  await db.execute(sql`
    UPDATE nodes n SET box_id = d.box_id
    FROM documents d
    WHERE n.document_id = d.id AND n.box_id IS NULL AND d.box_id IS NOT NULL
  `);
  await db.execute(sql`
    UPDATE edges e SET box_id = d.box_id
    FROM documents d
    WHERE e.document_id = d.id AND e.box_id IS NULL AND d.box_id IS NOT NULL
  `);
}

export async function initializeDatabase(db: ReturnType<typeof drizzle>) {
  // Enable pgvector extension
  await db.execute(enablePgvectorSql);

  // Create vector search function
  await db.execute(vectorSearchSql);

  // Create HNSW index
  await db.execute(hnswIndexSql);
}

export * from "./repositories/index.js";
