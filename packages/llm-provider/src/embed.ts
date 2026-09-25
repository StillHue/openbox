import { mistral } from '@ai-sdk/mistral';
import { embed, embedMany } from 'ai';
import { z } from 'zod';

const EMBEDDING_MODEL = 'mistral-embed';
const EMBEDDING_DIMENSIONS = 1024;

const embedSchema = z.object({
  values: z.array(z.number()),
  usage: z.object({
    promptTokens: z.number(),
    totalTokens: z.number(),
  }),
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embed({
    model: mistral.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });

  const parsed = embedSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid embedding response: ${parsed.error.message}`);
  }

  if (parsed.data.values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${parsed.data.values.length}`);
  }

  return parsed.data.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const result = await embedMany({
    model: mistral.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });

  const parsed = z.array(embedSchema).safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid embeddings response: ${parsed.error.message}`);
  }

  return parsed.data.map((d) => d.values);
}

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

export function getEmbeddingModelName(): string {
  return EMBEDDING_MODEL;
}