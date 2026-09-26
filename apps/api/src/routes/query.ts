import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { generateEmbedding } from '@openbox/llm-provider';
import { safeEmbeddingModel } from '@openbox/llm-provider';
import { createBoxRepository, createDocumentRepository, createQueryRepository } from '@openbox/db';

const querySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).default(10),
  documentIds: z.array(z.string().uuid()).optional(),
  boxId: z.string().uuid().optional(),
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

        const { query, topK, documentIds, boxId } = parsed.data;

        let embeddingModel: string | undefined;
        let scopedDocumentIds = documentIds;

        if (boxId !== undefined) {
          const box = await createBoxRepository(fastify.db).findById(boxId);
          if (!box) {
            return reply.code(400).send({ error: 'Box not found' });
          }
          embeddingModel = safeEmbeddingModel(box.embeddingModel);
          const boxDocumentIds = await createDocumentRepository(fastify.db).getIdsByBox(boxId);
          scopedDocumentIds =
            documentIds !== undefined
              ? boxDocumentIds.filter((id) => documentIds.includes(id))
              : boxDocumentIds;
        }

        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query, embeddingModel);

        // Search similar chunks
        const queryRepo = createQueryRepository(fastify.db);
        const results = await queryRepo.search(queryEmbedding, topK, scopedDocumentIds);

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
