import { parseDynamicModelId } from './providers.js';

export type ProviderCapability = 'embed' | 'answer' | 'judge';

export interface ProviderInfo {
  id: string;
  label: string;
  capabilities: ProviderCapability[];
}

export interface EmbeddingModelInfo {
  id: string;
  label: string;
  dimensions: number;
  provider: string;
  /** Native dims when the provider returns more than `dimensions` (sliced + L2-renormalized) */
  nativeDimensions?: number;
}

export interface AnswerModelInfo {
  id: string;
  label: string;
  description: string;
  provider: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'nvidia', label: 'NVIDIA NIM', capabilities: ['embed'] },
  { id: 'openrouter', label: 'OpenRouter', capabilities: ['answer'] },
  { id: 'typesafe', label: 'TypeSafe Jev', capabilities: ['judge'] },
  { id: 'openbox', label: 'OpenBox built-in', capabilities: ['judge'] },
];

export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  {
    id: 'nemotron-3-embed-1b',
    label: 'Nemotron 3 Embed 1B',
    dimensions: 1024,
    provider: 'nvidia',
    nativeDimensions: 2048,
  },
];

export const ANSWER_MODELS: AnswerModelInfo[] = [
  { id: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron Lightning (free)', description: 'Fast NVIDIA reasoning model via OpenRouter', provider: 'openrouter' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron Nano 30B', description: 'Efficient NVIDIA model via OpenRouter', provider: 'openrouter' },
];

export const DEFAULT_EMBEDDING_MODEL = 'nemotron-3-embed-1b';
export const DEFAULT_ANSWER_MODEL = 'nvidia/nemotron-3.5-lightning:free';
export const DEFAULT_JUDGE_MODEL = 'jev-latest';

export interface JudgeModelInfo {
  id: string;
  label: string;
  description: string;
  provider: string;
}

export const JUDGE_MODELS: JudgeModelInfo[] = [
  { id: 'jev-latest', label: 'Jev (TypeSafe)', description: 'Typed probabilities gate (noul)', provider: 'typesafe' },
  { id: 'classifier', label: 'Classifier (no Jev key needed)', description: 'Built-in option using the box answer model', provider: 'openbox' },
];

const VECTOR_DIMENSIONS = 1024;

export function getEmbeddingModelInfo(modelId: string): EmbeddingModelInfo {
  const dynamic = parseDynamicModelId(modelId);
  if (dynamic) {
    // Dynamic provider model (`provider:nativeId`) — dimensions are
    // normalized to the vector size at embed time (sliced/renormalized).
    return {
      id: modelId,
      label: dynamic.nativeId,
      dimensions: VECTOR_DIMENSIONS,
      provider: dynamic.providerId,
    };
  }
  const info = EMBEDDING_MODELS.find((m) => m.id === modelId);
  if (!info) {
    throw new Error(`Unknown embedding model: ${modelId}`);
  }
  return info;
}

export function isSupportedEmbeddingModel(modelId: string): boolean {
  return EMBEDDING_MODELS.some((m) => m.id === modelId) || parseDynamicModelId(modelId) !== null;
}

/** Return the model id if supported, otherwise the default (for stale box configs). */
export function safeEmbeddingModel(modelId: string): string {
  return isSupportedEmbeddingModel(modelId) ? modelId : DEFAULT_EMBEDDING_MODEL;
}

export function getAnswerModelInfo(modelId: string): AnswerModelInfo {
  const dynamic = parseDynamicModelId(modelId);
  if (dynamic) {
    return {
      id: modelId,
      label: dynamic.nativeId,
      description: `via ${dynamic.providerId}`,
      provider: dynamic.providerId,
    };
  }
  const info = ANSWER_MODELS.find((m) => m.id === modelId);
  if (!info) {
    throw new Error(`Unknown answer model: ${modelId}`);
  }
  return info;
}

export function isSupportedAnswerModel(modelId: string): boolean {
  return ANSWER_MODELS.some((m) => m.id === modelId) || parseDynamicModelId(modelId) !== null;
}

/** Return the model id if supported, otherwise the default (for stale box configs). */
export function safeAnswerModel(modelId: string): string {
  return isSupportedAnswerModel(modelId) ? modelId : DEFAULT_ANSWER_MODEL;
}

export function isSupportedJudgeModel(modelId: string): boolean {
  return JUDGE_MODELS.some((m) => m.id === modelId);
}

/** Return the model id if supported, otherwise the default (for stale box configs). */
export function safeJudgeModel(modelId: string): string {
  return isSupportedJudgeModel(modelId) ? modelId : DEFAULT_JUDGE_MODEL;
}

export function getVectorDimensions(): number {
  return VECTOR_DIMENSIONS;
}
