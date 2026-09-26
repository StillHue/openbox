import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createBoxRepository, createDocumentRepository, createQueryRepository, createChunkRepository } from '@openbox/db';
import {
  generateAnswer,
  generateEmbedding,
  EMBEDDING_MODELS,
  ANSWER_MODELS,
  JUDGE_MODELS,
  PROVIDERS,
  DYNAMIC_PROVIDERS,
  getDynamicProvider,
  listProviderModels,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_ANSWER_MODEL,
  DEFAULT_JUDGE_MODEL,
  isSupportedEmbeddingModel,
  isSupportedAnswerModel,
  isSupportedJudgeModel,
  safeAnswerModel,
  safeEmbeddingModel,
} from '@openbox/llm-provider';

const createBoxSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  embeddingModel: z.string().default(DEFAULT_EMBEDDING_MODEL),
  answerModel: z.string().default(DEFAULT_ANSWER_MODEL),
  judgeModel: z.string().default(DEFAULT_JUDGE_MODEL),
});

const updateBoxSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  embeddingModel: z.string().optional(),
  answerModel: z.string().optional(),
  judgeModel: z.string().optional(),
});

const askSchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(20).default(5),
});

const listProviderModelsSchema = z.object({
  provider: z.string().min(1).max(50),
  apiKey: z.string().max(500).optional(),
});

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof import('@openbox/db').createDbClient>['db'];
  }
}

export async function boxesRoutes(fastify: FastifyInstance) {
  const boxRepo = () => createBoxRepository(fastify.db);

  fastify.get('/models', async () => ({
    providers: PROVIDERS,
    dynamicProviders: DYNAMIC_PROVIDERS.map(({ id, label, docsUrl, publicListing }) => ({
      id,
      label,
      docsUrl,
      publicListing: publicListing ?? false,
    })),
    embeddingModels: EMBEDDING_MODELS,
    answerModels: ANSWER_MODELS,
    judgeModels: JUDGE_MODELS,
    defaults: {
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      answerModel: DEFAULT_ANSWER_MODEL,
      judgeModel: DEFAULT_JUDGE_MODEL,
    },
  }));

  /**
   * List a provider's models live, using a user-supplied API key.
   * The key is used transiently for this request only — never stored or logged.
   */
  fastify.post('/providers/models', async (request: FastifyRequest, reply) => {
    const parsed = listProviderModelsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const { provider, apiKey } = parsed.data;
    const info = getDynamicProvider(provider);
    if (!info) {
      return reply.code(400).send({ error: `Unknown provider: ${provider}` });
    }
    if (!apiKey && !info.publicListing) {
      return reply.code(400).send({ error: `An API key is required to list ${info.label} models` });
    }
    try {
      const models = await listProviderModels(info, apiKey);
      return models;
    } catch (e) {
      return reply.code(502).send({ error: `Failed to list models: ${(e as Error).message}`.slice(0, 400) });
    }
  });

  fastify.get('/boxes', async () => {
    return boxRepo().list();
  });

  fastify.post('/boxes', async (request: FastifyRequest, reply) => {
    const parsed = createBoxSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const { name, description, embeddingModel, answerModel, judgeModel } = parsed.data;
    if (!isSupportedEmbeddingModel(embeddingModel)) {
      return reply.code(400).send({ error: `Unsupported embedding model: ${embeddingModel}` });
    }
    if (!isSupportedAnswerModel(answerModel)) {
      return reply.code(400).send({ error: `Unsupported answer model: ${answerModel}` });
    }
    if (!isSupportedJudgeModel(judgeModel)) {
      return reply.code(400).send({ error: `Unsupported judge model: ${judgeModel}` });
    }
    const box = await boxRepo().create({ name, description, embeddingModel, answerModel, judgeModel });
    return reply.code(201).send(box);
  });

  fastify.get('/boxes/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const box = await boxRepo().findById(id);
    if (!box) {
      return reply.code(404).send({ error: 'Box not found' });
    }
    return reply.send(box);
  });

  fastify.patch('/boxes/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateBoxSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const { embeddingModel, answerModel, judgeModel, ...rest } = parsed.data;
    if (embeddingModel !== undefined && !isSupportedEmbeddingModel(embeddingModel)) {
      return reply.code(400).send({ error: `Unsupported embedding model: ${embeddingModel}` });
    }
    if (answerModel !== undefined && !isSupportedAnswerModel(answerModel)) {
      return reply.code(400).send({ error: `Unsupported answer model: ${answerModel}` });
    }
    if (judgeModel !== undefined && !isSupportedJudgeModel(judgeModel)) {
      return reply.code(400).send({ error: `Unsupported judge model: ${judgeModel}` });
    }
    const box = await boxRepo().update(id, { ...rest, embeddingModel, answerModel, judgeModel });
    if (!box) {
      return reply.code(404).send({ error: 'Box not found' });
    }
    return reply.send(box);
  });

  fastify.delete('/boxes/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const box = await boxRepo().findById(id);
    if (!box) {
      return reply.code(404).send({ error: 'Box not found' });
    }
    await boxRepo().delete(id);
    return reply.code(204).send();
  });

  fastify.get('/boxes/:id/documents', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const box = await boxRepo().findById(id);
    if (!box) {
      return reply.code(404).send({ error: 'Box not found' });
    }
    const docRepo = createDocumentRepository(fastify.db);
    return docRepo.listByBox(id, Number(limit) || 50, Number(offset) || 0);
  });

  fastify.get('/boxes/:id/graph', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const box = await boxRepo().findById(id);
    if (!box) {
      return reply.code(404).send({ error: 'Box not found' });
    }

    const docRepo = createDocumentRepository(fastify.db);
    const chunkRepo = createChunkRepository(fastify.db);
    const docs = await docRepo.listByBox(id, 2000, 0);

    // Mean-pool chunk embeddings into one vector per document
    const docVectors = new Map<string, number[]>();
    for (const doc of docs) {
      if (doc.status !== 'completed') continue;
      const chunks = await chunkRepo.findByDocumentId(doc.id);
      const vectors: number[][] = [];
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;
        try {
          const vec = JSON.parse(chunk.embedding) as number[];
          if (Array.isArray(vec) && vec.length > 0) vectors.push(vec);
        } catch {
          // skip malformed embeddings
        }
      }
      if (vectors.length === 0) continue;
      const dims = vectors[0].length;
      const mean = new Array<number>(dims).fill(0);
      for (const vec of vectors) {
        if (vec.length !== dims) continue;
        for (let i = 0; i < dims; i++) mean[i] += vec[i];
      }
      const norm = Math.sqrt(mean.reduce((acc, v) => acc + v * v, 0)) || 1;
      docVectors.set(doc.id, mean.map((v) => v / norm));
    }

    // Cosine similarity between every document pair (vector context links)
    const edges: Array<{ source: string; target: string; similarity: number }> = [];
    const ids = [...docVectors.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = docVectors.get(ids[i])!;
        const b = docVectors.get(ids[j])!;
        let dot = 0;
        for (let k = 0; k < a.length && k < b.length; k++) dot += a[k] * b[k];
        if (dot >= 0.45) {
          edges.push({ source: ids[i], target: ids[j], similarity: Math.round(dot * 1000) / 1000 });
        }
      }
    }
    edges.sort((x, y) => y.similarity - x.similarity);

    return {
      nodes: docs.map((doc) => ({
        id: doc.id,
        name: doc.originalName,
        mimeType: doc.mimeType,
        status: doc.status,
        isRule: doc.mimeType.includes('markdown') || doc.originalName.endsWith('.md'),
      })),
      edges: edges.slice(0, 100),
    };
  });

  fastify.post('/boxes/:id/ask', async (request: FastifyRequest, reply) => {
    const startTime = Date.now();
    const { id } = request.params as { id: string };
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const { query, topK } = parsed.data;

    const box = await boxRepo().findById(id);
    if (!box) {
      return reply.code(404).send({ error: 'Box not found' });
    }

    try {
      const docRepo = createDocumentRepository(fastify.db);
      const documentIds = await docRepo.getIdsByBox(id);

      const queryEmbedding = await generateEmbedding(query, safeEmbeddingModel(box.embeddingModel));

      const queryRepo = createQueryRepository(fastify.db);
      const results = await queryRepo.search(queryEmbedding, topK, documentIds);

      const sources = results.map((r) => ({
        documentId: r.documentId,
        documentName: r.document.originalName,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: r.similarity,
      }));

      // Golden rules: completed .md docs in this box guide how to use the info
      const chunkRepo = createChunkRepository(fastify.db);
      const boxDocs = await docRepo.listByBox(id, 100, 0);
      const ruleDocs = boxDocs.filter(
        (d) =>
          d.status === 'completed' &&
          (d.mimeType.includes('markdown') || d.originalName.endsWith('.md'))
      );
      let goldenRules: string | undefined;
      if (ruleDocs.length > 0) {
        const parts: string[] = [];
        for (const ruleDoc of ruleDocs.slice(0, 5)) {
          const chunks = await chunkRepo.findByDocumentId(ruleDoc.id);
          const text = chunks
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .map((c) => c.content)
            .join('\n')
            .slice(0, 2000);
          if (text) parts.push(`--- ${ruleDoc.originalName} ---\n${text}`);
        }
        if (parts.length > 0) goldenRules = parts.join('\n\n').slice(0, 8000);
      }

      const { answer, model } = await generateAnswer(query, sources, safeAnswerModel(box.answerModel), goldenRules);

      return reply.send({
        answer,
        model,
        sources,
        query,
        tookMs: Date.now() - startTime,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Error answering:');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
