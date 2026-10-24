import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc } from "drizzle-orm";
import { boxes } from "../schema.js";
import type { Box, NewBox } from "../schema.js";

export interface BoxRepository {
  create(data: NewBox): Promise<Box>;
  list(): Promise<Box[]>;
  findById(id: string): Promise<Box | null>;
  update(
    id: string,
    data: Partial<
      Pick<Box, "name" | "description" | "embeddingModel" | "answerModel" | "judgeModel">
    >,
  ): Promise<Box | null>;
  delete(id: string): Promise<void>;
}

export function createBoxRepository(
  db: ReturnType<typeof drizzle>,
): BoxRepository {
  return {
    async create(data) {
      const [box] = await db.insert(boxes).values(data).returning();
      return box;
    },

    async list() {
      return db.select().from(boxes).orderBy(desc(boxes.createdAt));
    },

    async findById(id) {
      const [box] = await db
        .select()
        .from(boxes)
        .where(eq(boxes.id, id))
        .limit(1);
      return box ?? null;
    },

    async update(id, data) {
      const [box] = await db
        .update(boxes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(boxes.id, id))
        .returning();
      return box ?? null;
    },

    async delete(id) {
      await db.delete(boxes).where(eq(boxes.id, id));
    },
  };
}
