import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, isNull, and } from "drizzle-orm";
import { apiKeys, users } from "../schema.js";
import type { ApiKey, NewApiKey, User, NewUser } from "../schema.js";

export interface ApiKeyRepository {
  create(data: NewApiKey): Promise<ApiKey>;
  findValidByHash(keyHash: string): Promise<ApiKey | null>;
  list(): Promise<ApiKey[]>;
  revoke(id: string): Promise<ApiKey | null>;
  touchLastUsed(id: string): Promise<void>;
  countActive(): Promise<number>;
}

export function createApiKeyRepository(
  db: ReturnType<typeof drizzle>,
): ApiKeyRepository {
  return {
    async create(data) {
      const [key] = await db.insert(apiKeys).values(data).returning();
      return key;
    },

    async findValidByHash(keyHash) {
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
        .limit(1);
      return key ?? null;
    },

    async list() {
      return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    },

    async revoke(id) {
      const [key] = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
        .returning();
      return key ?? null;
    },

    async touchLastUsed(id) {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, id));
    },

    async countActive() {
      const rows = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(isNull(apiKeys.revokedAt));
      return rows.length;
    },
  };
}

export interface UserRepository {
  create(data: NewUser): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updateProfile(id: string, data: { name: string | null }): Promise<User | null>;
  updatePassword(id: string, passwordHash: string): Promise<User | null>;
  count(): Promise<number>;
}

export function createUserRepository(
  db: ReturnType<typeof drizzle>,
): UserRepository {
  return {
    async create(data) {
      const [user] = await db.insert(users).values(data).returning();
      return user;
    },

    async findByEmail(email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);
      return user ?? null;
    },

    async count() {
      const rows = await db.select({ id: users.id }).from(users);
      return rows.length;
    },

    async findById(id) {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user ?? null;
    },

    async updateProfile(id, { name }) {
      const [user] = await db
        .update(users)
        .set({ name })
        .where(eq(users.id, id))
        .returning();
      return user ?? null;
    },

    async updatePassword(id, passwordHash) {
      const [user] = await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, id))
        .returning();
      return user ?? null;
    },
  };
}
