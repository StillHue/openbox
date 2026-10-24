import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql, inArray } from "drizzle-orm";
import { nodes, edges } from "../schema.js";
import type { Node, NewNode, Edge, NewEdge } from "../schema.js";

export interface NodeRepository {
  createMany(data: NewNode[]): Promise<Node[]>;
  findByDocumentId(documentId: string): Promise<Node[]>;
  findById(id: string): Promise<Node | null>;
  findByIds(ids: string[]): Promise<Node[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findByNameAndType(
    name: string,
    type: string,
    documentId?: string,
  ): Promise<Node | null>;
  findInBox(boxId: string, type: string, name: string): Promise<Node | null>;
  update(
    id: string,
    patch: Partial<Pick<Node, "description" | "properties" | "confidence" | "embedding" | "boxId">>,
  ): Promise<Node | null>;
  listMissingEmbeddings(boxId: string, limit: number): Promise<Node[]>;
  countMissingEmbeddings(boxId: string): Promise<number>;
  searchByEmbedding(
    boxId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<Array<Node & { similarity: number }>>;
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

    async findByIds(ids) {
      if (ids.length === 0) return [];
      return db.select().from(nodes).where(inArray(nodes.id, ids));
    },

    async findById(id) {
      const [node] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, id))
        .limit(1);
      return node ?? null;
    },

    async deleteByDocumentId(documentId) {
      await db.delete(nodes).where(eq(nodes.documentId, documentId));
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

    async findInBox(boxId, type, name) {
      const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
      const [node] = await db
        .select()
        .from(nodes)
        .where(
          sql`box_id = ${boxId} AND type = ${type} AND lower(trim(name)) = ${normalized}`,
        )
        .limit(1);
      return node ?? null;
    },

    async update(id, patch) {
      const [node] = await db
        .update(nodes)
        .set(patch)
        .where(eq(nodes.id, id))
        .returning();
      return node ?? null;
    },

    async listMissingEmbeddings(boxId, limit) {
      return db
        .select()
        .from(nodes)
        .where(sql`box_id = ${boxId} AND (embedding IS NULL OR embedding = '')`)
        .limit(limit);
    },

    async countMissingEmbeddings(boxId) {
      const rows = await db.execute(sql`
        SELECT count(*)::int AS count
        FROM nodes
        WHERE box_id = ${boxId} AND (embedding IS NULL OR embedding = '')
      `);
      return Number(rows[0]?.count ?? 0);
    },

    async searchByEmbedding(boxId, queryEmbedding, topK) {
      const embeddingStr = `[${queryEmbedding.join(",")}]`;
      const rows = await db.execute(sql`
        SELECT
          id,
          document_id as "documentId",
          box_id as "boxId",
          type,
          name,
          description,
          properties,
          confidence,
          embedding,
          created_at as "createdAt",
          1 - (embedding::vector <=> ${embeddingStr}::vector) as similarity
        FROM nodes
        WHERE box_id = ${boxId}
          AND embedding IS NOT NULL
          AND embedding <> ''
        ORDER BY embedding::vector <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `);
      return rows.map((row) => ({
        id: String(row.id),
        documentId: String(row.documentId),
        boxId: row.boxId ? String(row.boxId) : null,
        type: String(row.type),
        name: String(row.name),
        description: row.description == null ? null : String(row.description),
        properties: (row.properties ?? {}) as Record<string, unknown>,
        confidence: Number(row.confidence),
        embedding: row.embedding == null ? null : String(row.embedding),
        createdAt: new Date(String(row.createdAt)),
        similarity: Number(row.similarity),
      }));
    },
  };
}

export interface EdgeRepository {
  createMany(data: NewEdge[]): Promise<Edge[]>;
  findByDocumentId(documentId: string): Promise<Edge[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findBySourceId(sourceId: string): Promise<Edge[]>;
  findByTargetId(targetId: string): Promise<Edge[]>;
  findInBox(
    boxId: string,
    sourceId: string,
    targetId: string,
    type: string,
  ): Promise<Edge | null>;
  findTouching(boxId: string, nodeIds: string[], limit: number): Promise<Edge[]>;
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

    async deleteByDocumentId(documentId) {
      await db.delete(edges).where(eq(edges.documentId, documentId));
    },

    async findBySourceId(sourceId) {
      return db.select().from(edges).where(eq(edges.sourceId, sourceId));
    },

    async findByTargetId(targetId) {
      return db.select().from(edges).where(eq(edges.targetId, targetId));
    },

    async findInBox(boxId, sourceId, targetId, type) {
      const [edge] = await db
        .select()
        .from(edges)
        .where(
          sql`box_id = ${boxId} AND source_id = ${sourceId} AND target_id = ${targetId} AND type = ${type}`,
        )
        .limit(1);
      return edge ?? null;
    },

    async findTouching(boxId, nodeIds, limit) {
      if (nodeIds.length === 0) return [];
      return db
        .select()
        .from(edges)
        .where(
          sql`box_id = ${boxId} AND (${inArray(edges.sourceId, nodeIds)} OR ${inArray(edges.targetId, nodeIds)})`,
        )
        .limit(limit);
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
