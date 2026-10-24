import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { chunks } from "../schema.js";
import type { Chunk, NewChunk } from "../schema.js";

export interface ChunkRepository {
  createMany(data: NewChunk[]): Promise<Chunk[]>;
  findByDocumentId(documentId: string): Promise<Chunk[]>;
  vectorSearch(
    queryEmbedding: number[],
    topK: number,
    documentIds?: string[],
  ): Promise<Array<Chunk & { similarity: number }>>;
  deleteByDocumentId(documentId: string): Promise<void>;
}

export function createChunkRepository(
  db: ReturnType<typeof drizzle>,
): ChunkRepository {
  return {
    async createMany(data) {
      if (data.length === 0) return [];
      return db.insert(chunks).values(data).returning();
    },

    async findByDocumentId(documentId) {
      return db
        .select()
        .from(chunks)
        .where(eq(chunks.documentId, documentId))
        .orderBy(chunks.chunkIndex);
    },

    async vectorSearch(queryEmbedding, topK, documentIds) {
      const embeddingStr = `[${queryEmbedding.join(",")}]`;
      const filterIds = documentIds ? `{${documentIds.join(",")}}` : null;

      const rows = await db.execute(sql`
        SELECT
          c.id,
          c.document_id as "documentId",
          c.content,
          c.chunk_index as "chunkIndex",
          c.metadata,
          1 - (c.embedding::vector <=> ${embeddingStr}::vector) as similarity
        FROM chunks c
        WHERE (${filterIds}::uuid[] IS NULL OR c.document_id = ANY(${filterIds}::uuid[]))
        ORDER BY c.embedding::vector <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `);

      // Map the raw results to the expected type
      return rows.map((row: any) => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        metadata: row.metadata,
        embedding: null, // Not returned in SELECT but part of Chunk type
        createdAt: new Date(), // Not returned but part of Chunk type
        similarity: Number(row.similarity),
      })) as Array<Chunk & { similarity: number }>;
    },

    async deleteByDocumentId(documentId) {
      await db.delete(chunks).where(eq(chunks.documentId, documentId));
    },
  };
}
