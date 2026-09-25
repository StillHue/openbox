import { pgTable, uuid, text, timestamp, real, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  status: text('status').notNull().default('pending'),
  judgeScore: real('judge_score'),
  judgeMetadata: jsonb('judge_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    metadata: jsonb('metadata'),
    embedding: text('embedding'), // Stored as JSON string for pgvector
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    documentIdIdx: index('chunks_document_id_idx').on(table.documentId),
    chunkIndexIdx: index('chunks_chunk_index_idx').on(table.chunkIndex),
  })
);

// Graph tables for Phase 3
export const nodes = pgTable(
  'nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // e.g., 'Person', 'Organization', 'Concept', 'Location', 'Event'
    name: text('name').notNull(),
    description: text('description'),
    properties: jsonb('properties').notNull().default({}),
    confidence: real('confidence').notNull().default(0.5),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    documentIdIdx: index('nodes_document_id_idx').on(table.documentId),
    typeIdx: index('nodes_type_idx').on(table.type),
    nameIdx: index('nodes_name_idx').on(table.name),
  })
);

export const edges = pgTable(
  'edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    sourceId: uuid('source_id')
      .references(() => nodes.id, { onDelete: 'cascade' })
      .notNull(),
    targetId: uuid('target_id')
      .references(() => nodes.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // e.g., 'WORKS_FOR', 'LOCATED_IN', 'PART_OF', 'RELATED_TO'
    properties: jsonb('properties').notNull().default({}),
    confidence: real('confidence').notNull().default(0.5),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    documentIdIdx: index('edges_document_id_idx').on(table.documentId),
    sourceIdIdx: index('edges_source_id_idx').on(table.sourceId),
    targetIdIdx: index('edges_target_id_idx').on(table.targetId),
    typeIdx: index('edges_type_idx').on(table.type),
  })
);

// Vector similarity search function (to be created in migration)
export const vectorSearchSql = sql`
  CREATE OR REPLACE FUNCTION vector_search(
    query_embedding vector(1024),
    match_count int DEFAULT 10,
    filter_document_ids uuid[] DEFAULT NULL
  )
  RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    chunk_index integer,
    metadata jsonb,
    similarity float
  )
  LANGUAGE sql
  AS $$
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.chunk_index,
      c.metadata,
      1 - (c.embedding::vector <=> query_embedding) as similarity
    FROM chunks c
    WHERE (filter_document_ids IS NULL OR c.document_id = ANY(filter_document_ids))
    ORDER BY c.embedding::vector <=> query_embedding
    LIMIT match_count;
  $$;
`;

// HNSW index for vector similarity (created in migration)
export const hnswIndexSql = sql`
  CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON chunks
  USING hnsw ((embedding::vector) vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

// Enable pgvector extension
export const enablePgvectorSql = sql`CREATE EXTENSION IF NOT EXISTS vector;`;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
export type Edge = typeof edges.$inferSelect;
export type NewEdge = typeof edges.$inferInsert;