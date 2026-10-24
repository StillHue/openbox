import { drizzle } from "drizzle-orm/postgres-js";
import { createChunkRepository } from "./chunks.js";
import { createDocumentRepository } from "./documents.js";
import type { Document, Chunk } from "../schema.js";

export interface QueryRepository {
  search(
    queryEmbedding: number[],
    topK: number,
    documentIds?: string[],
  ): Promise<
    Array<
      Chunk & {
        similarity: number;
        document: Pick<Document, "id" | "filename" | "originalName">;
      }
    >
  >;
}

export function createQueryRepository(
  db: ReturnType<typeof drizzle>,
): QueryRepository {
  const chunkRepo = createChunkRepository(db);
  const docRepo = createDocumentRepository(db);

  return {
    async search(queryEmbedding, topK, documentIds) {
      const results = await chunkRepo.vectorSearch(
        queryEmbedding,
        topK,
        documentIds,
      );

      // Fetch document info for each result
      const documentIdsUnique = [...new Set(results.map((r) => r.documentId))];
      const docs = await Promise.all(
        documentIdsUnique.map((id) => docRepo.findById(id)),
      );
      const docMap = new Map(
        docs
          .filter((d): d is Document => d !== null)
          .map((d: Document) => [d.id, d]),
      );

      return results.map((r) => ({
        ...r,
        document: {
          id: r.documentId,
          filename: docMap.get(r.documentId)?.filename ?? "",
          originalName: docMap.get(r.documentId)?.originalName ?? "",
        },
      }));
    },
  };
}
