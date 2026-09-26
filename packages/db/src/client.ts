import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  boxes,
  documents,
  chunks,
  nodes,
  edges,
  rules,
  vectorSearchSql,
  hnswIndexSql,
  enablePgvectorSql,
} from "./schema.js";
import { eq, desc, sql, isNull, inArray } from "drizzle-orm";
import type {
  Box,
  NewBox,
  Rule,
  NewRule,
  Document,
  Chunk,
  NewDocument,
  NewChunk,
  Node,
  NewNode,
  Edge,
  NewEdge,
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

export async function initializeDatabase(db: ReturnType<typeof drizzle>) {
  // Enable pgvector extension
  await db.execute(enablePgvectorSql);

  // Create vector search function
  await db.execute(vectorSearchSql);

  // Create HNSW index
  await db.execute(hnswIndexSql);
}

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
  getIdsByBox(boxId: string): Promise<string[]>;
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

    async getIdsByBox(boxId) {
      const rows = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.boxId, boxId));
      return rows.map((r) => r.id);
    },
  };
}

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

export interface NodeRepository {
  createMany(data: NewNode[]): Promise<Node[]>;
  findByDocumentId(documentId: string): Promise<Node[]>;
  findById(id: string): Promise<Node | null>;
  findByNameAndType(
    name: string,
    type: string,
    documentId?: string,
  ): Promise<Node | null>;
}

export function createNodeRepository(
  db: ReturnType<typeof drizzle>,
): NodeRepository {
  return {
    async createMany(data) {
      if (data.length === 0) return [];
      return db.insert(nodes).values(data).returning();
    },

    async findByDocumentId(documentId) {
      return db
        .select()
        .from(nodes)
        .where(eq(nodes.documentId, documentId))
        .orderBy(nodes.type, nodes.name);
    },

    async findById(id) {
      const [node] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, id))
        .limit(1);
      return node ?? null;
    },

    async findByNameAndType(name, type, documentId) {
      const conditions = [eq(nodes.name, name), eq(nodes.type, type)];
      if (documentId) {
        conditions.push(eq(nodes.documentId, documentId));
      }
      const [node] = await db
        .select()
        .from(nodes)
        .where(
          sql`${conditions[0]} AND ${conditions[1]} ${documentId ? sql`AND ${conditions[2]}` : sql``}`,
        )
        .limit(1);
      return node ?? null;
    },
  };
}

export interface EdgeRepository {
  createMany(data: NewEdge[]): Promise<Edge[]>;
  findByDocumentId(documentId: string): Promise<Edge[]>;
  findBySourceId(sourceId: string): Promise<Edge[]>;
  findByTargetId(targetId: string): Promise<Edge[]>;
}

export function createEdgeRepository(
  db: ReturnType<typeof drizzle>,
): EdgeRepository {
  return {
    async createMany(data) {
      if (data.length === 0) return [];
      return db.insert(edges).values(data).returning();
    },

    async findByDocumentId(documentId) {
      return db.select().from(edges).where(eq(edges.documentId, documentId));
    },

    async findBySourceId(sourceId) {
      return db.select().from(edges).where(eq(edges.sourceId, sourceId));
    },

    async findByTargetId(targetId) {
      return db.select().from(edges).where(eq(edges.targetId, targetId));
    },
  };
}

export interface GraphRepository {
  getGraph(documentId: string): Promise<{ nodes: Node[]; edges: Edge[] }>;
  getSubgraph(
    documentId: string,
    nodeIds: string[],
  ): Promise<{ nodes: Node[]; edges: Edge[] }>;
  findPaths(
    documentId: string,
    sourceId: string,
    targetId: string,
    maxDepth?: number,
  ): Promise<Node[][]>;
}

export function createGraphRepository(
  db: ReturnType<typeof drizzle>,
): GraphRepository {
  const nodeRepo = createNodeRepository(db);
  const edgeRepo = createEdgeRepository(db);

  return {
    async getGraph(documentId) {
      const [nodesList, edgesList] = await Promise.all([
        nodeRepo.findByDocumentId(documentId),
        edgeRepo.findByDocumentId(documentId),
      ]);
      return { nodes: nodesList, edges: edgesList };
    },

    async getSubgraph(documentId, nodeIds) {
      if (nodeIds.length === 0) return { nodes: [], edges: [] };
      const nodesList = await db
        .select()
        .from(nodes)
        .where(inArray(nodes.id, nodeIds));
      const edgesList = await db
        .select()
        .from(edges)
        .where(
          sql`${edges.documentId} = ${documentId} AND (${inArray(edges.sourceId, nodeIds)} OR ${inArray(edges.targetId, nodeIds)}))`,
        );
      return { nodes: nodesList, edges: edgesList };
    },

    async findPaths(documentId, sourceId, targetId, maxDepth = 3) {
      // Simple BFS for finding paths (limited depth)
      const paths: Node[][] = [];
      const queue: { nodeId: string; path: Node[] }[] = [
        { nodeId: sourceId, path: [] },
      ];
      const visited = new Set<string>();

      while (queue.length > 0 && paths.length < 10) {
        const { nodeId, path } = queue.shift()!;
        if (visited.has(nodeId)) continue;
        if (path.length >= maxDepth) continue;

        visited.add(nodeId);
        const node = await nodeRepo.findById(nodeId);
        if (!node) continue;

        const newPath = [...path, node];

        if (nodeId === targetId) {
          paths.push(newPath);
          continue;
        }

        // Get outgoing edges
        const outgoingEdges = await edgeRepo.findBySourceId(nodeId);
        for (const edge of outgoingEdges) {
          queue.push({ nodeId: edge.targetId, path: newPath });
        }
      }

      return paths;
    },
  };
}
