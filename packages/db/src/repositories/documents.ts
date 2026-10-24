import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, desc, isNull } from "drizzle-orm";
import { documents } from "../schema.js";
import type { Document, NewDocument } from "../schema.js";

export interface DocumentRepository {
  create(data: NewDocument): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  updateStatus(
    id: string,
    status: Document["status"],
    judgeScore?: number,
    judgeMetadata?: Document["judgeMetadata"],
  ): Promise<Document | null>;
  delete(id: string): Promise<void>;
  list(limit?: number, offset?: number): Promise<Document[]>;
  listByBox(
    boxId: string,
    limit?: number,
    offset?: number,
  ): Promise<Document[]>;
  listUnassigned(limit?: number, offset?: number): Promise<Document[]>;
  getIdsByBox(boxId: string, status?: string): Promise<string[]>;
}

export function createDocumentRepository(
  db: ReturnType<typeof drizzle>,
): DocumentRepository {
  return {
    async create(data) {
      const [doc] = await db.insert(documents).values(data).returning();
      return doc;
    },

    async findById(id) {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      return doc ?? null;
    },

    async updateStatus(id, status, judgeScore, judgeMetadata) {
      const [doc] = await db
        .update(documents)
        .set({
          status,
          judgeScore,
          judgeMetadata,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id))
        .returning();
      return doc ?? null;
    },

    async delete(id) {
      await db.delete(documents).where(eq(documents.id, id));
    },

    async list(limit = 50, offset = 0) {
      return db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async listByBox(boxId, limit = 50, offset = 0) {
      return db
        .select()
        .from(documents)
        .where(eq(documents.boxId, boxId))
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async listUnassigned(limit = 50, offset = 0) {
      return db
        .select()
        .from(documents)
        .where(isNull(documents.boxId))
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async getIdsByBox(boxId, status) {
      const rows = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          status
            ? and(eq(documents.boxId, boxId), eq(documents.status, status))
            : eq(documents.boxId, boxId),
        );
      return rows.map((r) => r.id);
    },
  };
}
