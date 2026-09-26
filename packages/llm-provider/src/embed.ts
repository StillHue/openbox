import { mistral } from '@ai-sdk/mistral';
import { embedMany } from 'ai';
import {
  DEFAULT_EMBEDDING_MODEL,
  getEmbeddingModelInfo,
  getVectorDimensions,
} from './models.js';
import { generateNvidiaEmbeddings, sliceAndNormalize } from './nvidia.js';
import { getDynamicProvider, parseDynamicModelId } from './providers.js';

function assertDimensions(values: number[], modelId: string, expected: number): void {
  if (!Array.isArray(values) || values.length !== expected) {
    throw new Error(`Model ${modelId} returned ${values?.length} dimensions, expected ${expected}`);
  }
  if (expected !== getVectorDimensions()) {
    throw new Error(
      `Embedding model ${modelId} has ${expected} dimensions, ` +
        `but the vector index requires ${getVectorDimensions()}`
    );
  }
}

export async function generateEmbedding(text: string, modelId: string = DEFAULT_EMBEDDING_MODEL): Promise<number[]> {
  const vectors = await generateEmbeddings([text], modelId);
  return vectors[0];
}

export async function generateEmbeddings(texts: string[], modelId: string = DEFAULT_EMBEDDING_MODEL): Promise<number[][]> {
  const info = getEmbeddingModelInfo(modelId);

  if (info.provider === 'nvidia') {
    const vectors = await generateNvidiaEmbeddings(texts, info.dimensions);
    vectors.forEach((v) => assertDimensions(v, info.id, info.dimensions));
    return vectors;
  }

  // Dynamic provider model (`provider:nativeId`) — generic OpenAI-compatible
  // embeddings call, normalized to the vector index size.
  const dynamic = parseDynamicModelId(modelId);
  if (dynamic) {
    const vectors = await generateOpenAiCompatibleEmbeddings(dynamic.providerId, dynamic.nativeId, texts);
    vectors.forEach((v) => assertDimensions(v, info.id, getVectorDimensions()));
    return vectors;
  }

  const { embeddings } = await embedMany({
    model: mistral.textEmbeddingModel(info.id),
    values: texts,
  });

  embeddings.forEach((e) => assertDimensions(e, info.id, info.dimensions));
  return embeddings;
}

const EMBED_BATCH_SIZE = 32;

/** OpenAI-compatible /embeddings call for any registered dynamic provider. */
async function generateOpenAiCompatibleEmbeddings(providerId: string, nativeModelId: string, texts: string[]): Promise<number[][]> {
  const provider = getDynamicProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown dynamic provider: ${providerId}`);
  }
  const key = process.env[provider.keyEnv];
  if (!key) {
    throw new Error(`${provider.keyEnv} is not set (needed to embed with ${provider.label})`);
  }

  const targetDims = getVectorDimensions();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const response = await fetch(`${provider.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: nativeModelId, input: texts.slice(i, i + EMBED_BATCH_SIZE) }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`${provider.label} embedding error ${response.status}: ${body.slice(0, 300)}`);
    }
    const parsed = (await response.json()) as { data: Array<{ embedding: number[]; index: number }> };
    if (!Array.isArray(parsed.data)) {
      throw new Error(`Invalid ${provider.label} embedding response`);
    }
    const batch = [...parsed.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    for (const vec of batch) {
      if (vec.length < targetDims) {
        throw new Error(
          `${nativeModelId} returned ${vec.length} dimensions, but the vector index requires ${targetDims}. ` +
            `Pick an embedding model with at least ${targetDims} dimensions.`
        );
      }
      out.push(vec.length === targetDims ? vec : sliceAndNormalize(vec, targetDims));
    }
  }
  return out;
}

export function getEmbeddingDimensions(): number {
  return getVectorDimensions();
}

export function getEmbeddingModelName(): string {
  return DEFAULT_EMBEDDING_MODEL;
}
