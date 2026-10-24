import { drizzle } from "drizzle-orm/postgres-js";
import { createDocumentRepository } from "./documents.js";
import { createChunkRepository } from "./chunks.js";
import type { Document, Chunk, NewDocument, NewChunk } from "../schema.js";

export interface IngestRepository {
  createDocument(data: NewDocument): Promise<Document>;
  getDocument(id: string): Promise<(Document & { chunks: Chunk[] }) | null>;
  updateDocumentStatus(
    id: string,
    status: Document["status"],
    judgeScore?: number,
    judgeMetadata?: Document["judgeMetadata"],
  ): Promise<Document | null>;
  deleteDocument(id: string): Promise<void>;
  saveChunks(
    documentId: string,
    chunksData: Array<Omit<NewChunk, "documentId">>,
  ): Promise<Chunk[]>;
  list(limit?: number, offset?: number): Promise<Document[]>;
  listByBox(
    boxId: string,
    limit?: number,
    offset?: number,
  ): Promise<Document[]>;
  listUnassigned(limit?: number, offset?: number): Promise<Document[]>;
}

export function createIngestRepository(
  db: ReturnType<typeof drizzle>,
): IngestRepository {
  const docRepo = createDocumentRepository(db);
  const chunkRepo = createChunkRepository(db);

  return {
    async createDocument(data) {
      return docRepo.create(data);
    },

    async getDocument(id) {
      const doc = await docRepo.findById(id);
      if (!doc) return null;

      const docChunks = await chunkRepo.findByDocumentId(id);
      return { ...doc, chunks: docChunks };
    },

    async updateDocumentStatus(id, status, judgeScore, judgeMetadata) {
      return docRepo.updateStatus(id, status, judgeScore, judgeMetadata);
    },

    async deleteDocument(id) {
      return docRepo.delete(id);
    },

    async saveChunks(documentId, chunksData) {
      const newChunks: NewChunk[] = chunksData.map((c, i) => ({
        ...c,
        documentId,
        chunkIndex: i,
      }));
      return chunkRepo.createMany(newChunks);
    },

    async list(limit = 50, offset = 0) {
      return docRepo.list(limit, offset);
    },

    async listByBox(boxId, limit = 50, offset = 0) {
      return docRepo.listByBox(boxId, limit, offset);
    },

    async listUnassigned(limit = 50, offset = 0) {
      return docRepo.listUnassigned(limit, offset);
    },
  };
}
