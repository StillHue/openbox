import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createNodeRepository, createEdgeRepository, createGraphRepository } from '@openbox/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof import('@openbox/db').createDbClient>['db'];
  }
}

const nodeQuerySchema = z.object({
  query: z.string().min(1).max(200),
  type: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

const neighborsSchema = z.object({
  depth: z.number().int().min(1).max(3).default(1),
});

const pathsSchema = z.object({
  source: z.string().uuid(),
  target: z.string().uuid(),
  maxDepth: z.number().int().min(1).max(5).default(3),
});

export async function graphRoutes(fastify: FastifyInstance) {
  // Get full graph for a document
  fastify.get(
    '/graph/:documentId',
    async (request: FastifyRequest, reply) => {
      try {
        const { documentId } = request.params as { documentId: string };
        const graphRepo = createGraphRepository(fastify.db);
        const graph = await graphRepo.getGraph(documentId);

        return reply.send(graph);
      } catch (error) {
        fastify.log.error({ err: error }, 'Error getting graph:');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get neighbors for a node
  fastify.get(
    '/graph/:documentId/nodes/:nodeId/neighbors',
    async (request: FastifyRequest, reply) => {
      try {
        const { documentId, nodeId } = request.params as { documentId: string; nodeId: string };
        const query = neighborsSchema.parse(request.query);
        const nodeRepo = createNodeRepository(fastify.db);
        const edgeRepo = createEdgeRepository(fastify.db);

        // Get the center node
        const centerNode = await nodeRepo.findById(nodeId);
        if (!centerNode || centerNode.documentId !== documentId) {
          return reply.code(404).send({ error: 'Node not found' });
        }

        // BFS to get neighbors up to depth
        const visited = new Set<string>([nodeId]);
        const nodesToFetch = new Map<string, number>([[nodeId, 0]]);
        const allNodes = new Map<string, typeof centerNode>();
        const allEdges: Array<{ sourceId: string; targetId: string; type: string; properties: Record<string, unknown>; confidence: number; documentId: string; createdAt: string }> = [];

        allNodes.set(nodeId, centerNode);

        for (let depth = 0; depth < query.depth; depth++) {
          const currentLevel = Array.from(nodesToFetch.entries())
            .filter(([, d]) => d === depth)
            .map(([id]) => id);

          if (currentLevel.length === 0) break;

          for (const currentId of currentLevel) {
            const outgoingEdges = await edgeRepo.findBySourceId(currentId);
            const incomingEdges = await edgeRepo.findByTargetId(currentId);

            for (const edge of [...outgoingEdges, ...incomingEdges]) {
              if (edge.documentId !== documentId) continue;

              allEdges.push({
                ...edge,
                properties: edge.properties as Record<string, unknown>,
                createdAt: edge.createdAt.toISOString(),
              });

              const neighborId = edge.sourceId === currentId ? edge.targetId : edge.sourceId;
              if (!visited.has(neighborId)) {
                visited.add(neighborId);
                nodesToFetch.set(neighborId, depth + 1);
              }
            }
          }
        }

        // Fetch all neighbor nodes
        for (const neighborId of nodesToFetch.keys()) {
          if (neighborId !== nodeId) {
            const node = await nodeRepo.findById(neighborId);
            if (node) {
              allNodes.set(neighborId, node);
            }
          }
        }

        return reply.send({
          nodes: Array.from(allNodes.values()).map((n) => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
          })),
          edges: allEdges,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error getting neighbors:');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Find paths between two nodes
  fastify.get(
    '/graph/:documentId/paths',
    async (request: FastifyRequest, reply) => {
      try {
        const { documentId } = request.params as { documentId: string };
        const query = pathsSchema.parse(request.query);
        const graphRepo = createGraphRepository(fastify.db);
        const paths = await graphRepo.findPaths(documentId, query.source, query.target, query.maxDepth);

        return reply.send(paths);
      } catch (error) {
        fastify.log.error({ err: error }, 'Error finding paths:');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Search nodes
  fastify.get(
    '/graph/:documentId/nodes/search',
    async (request: FastifyRequest, reply) => {
      try {
        const { documentId } = request.params as { documentId: string };
        const query = nodeQuerySchema.parse(request.query);
        const nodeRepo = createNodeRepository(fastify.db);

        const nodes = await nodeRepo.findByDocumentId(documentId);
        const filtered = nodes.filter((n) => {
          const matchesQuery = n.name.toLowerCase().includes(query.query.toLowerCase());
          const matchesType = !query.type || n.type.toLowerCase() === query.type.toLowerCase();
          return matchesQuery && matchesType;
        });

        return reply.send(filtered.slice(0, query.limit).map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })));
      } catch (error) {
        fastify.log.error({ err: error }, 'Error searching nodes:');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}