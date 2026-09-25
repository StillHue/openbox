import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { generateEmbedding } from '@openbox/llm-provider';
import { createQueryRepository } from '@openbox/db';

const querySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).default(10),
  documentIds: z.array(z.string().uuid()).optional(),
});

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof import('@openbox/db').createDbClient>['db'];
  }
}

export async function queryRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/query',
    async (request: FastifyRequest, reply) => {
      const startTime = Date.now();

      try {
        const parsed = querySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Invalid request body',
            details: parsed.error.flatten(),
          });
        }

        const { query, topK, documentIds } = parsed.data;

        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);

        // Search similar chunks
        const queryRepo = createQueryRepository(fastify.db);
        const results = await queryRepo.search(queryEmbedding, topK, documentIds);

        const tookMs = Date.now() - startTime;

        return reply.send({
          results,
          query,
          tookMs,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Error querying:');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}