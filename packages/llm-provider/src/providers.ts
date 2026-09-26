/**
 * Dynamic provider registry.
 *
 * The orchestration tab (Settings → Orchestration) lets the user pick one of
 * these providers, paste an API key, and fetch that provider's model list
 * live. Selected models are stored as `provider:nativeModelId` and routed
 * accordingly at inference time.
 */

export type ListingKind = 'openai' | 'gemini';

export interface DynamicProvider {
  id: string;
  label: string;
  /** OpenAI-compatible base URL used for chat/embeddings and (usually) model listing. */
  baseUrl: string;
  /** Server-side env var holding the API key used by the ingestion/query pipeline. */
  keyEnv: string;
  /** Where the user can create an API key. */
  docsUrl: string;
  /** Model listing works without an API key. */
  publicListing?: boolean;
  /** Adapter used to list models. */
  listingKind: ListingKind;
  /** Gemini native listing URL (listingKind === 'gemini' only). */
  nativeListingUrl?: string;
}

export const DYNAMIC_PROVIDERS: DynamicProvider[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter (multi-vendor)',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    docsUrl: 'https://openrouter.ai/settings/keys',
    publicListing: true,
    listingKind: 'openai',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    keyEnv: 'NVIDIA_API_KEY',
    docsUrl: 'https://build.nvidia.com/',
    publicListing: true,
    listingKind: 'openai',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
    listingKind: 'openai',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyEnv: 'MISTRAL_API_KEY',
    docsUrl: 'https://console.mistral.ai/api-keys',
    listingKind: 'openai',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/keys',
    listingKind: 'openai',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    keyEnv: 'DEEPSEEK_API_KEY',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    listingKind: 'openai',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    keyEnv: 'TOGETHER_API_KEY',
    docsUrl: 'https://api.together.ai/settings/api-keys',
    listingKind: 'openai',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    keyEnv: 'XAI_API_KEY',
    docsUrl: 'https://console.x.ai',
    listingKind: 'openai',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    keyEnv: 'COHERE_API_KEY',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    listingKind: 'openai',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    docsUrl: 'https://aistudio.google.com/apikey',
    listingKind: 'gemini',
    nativeListingUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    keyEnv: 'FIREWORKS_API_KEY',
    docsUrl: 'https://fireworks.ai/account/api-keys',
    listingKind: 'openai',
  },
  {
    id: 'jina',
    label: 'Jina AI',
    baseUrl: 'https://api.jina.ai/v1',
    keyEnv: 'JINA_API_KEY',
    docsUrl: 'https://jina.ai/api-base/key',
    publicListing: true,
    listingKind: 'openai',
  },
];

export function getDynamicProvider(id: string): DynamicProvider | undefined {
  return DYNAMIC_PROVIDERS.find((p) => p.id === id);
}

/**
 * Parse a `provider:nativeModelId` model id.
 * Splits on the FIRST colon only, so native ids containing colons
 * (e.g. `openrouter:qwen/qwen3.8-27b:free`) survive intact.
 */
export function parseDynamicModelId(modelId: string): { providerId: string; nativeId: string } | null {
  const idx = modelId.indexOf(':');
  if (idx <= 0 || idx >= modelId.length - 1) return null;
  const providerId = modelId.slice(0, idx);
  const nativeId = modelId.slice(idx + 1);
  return getDynamicProvider(providerId) ? { providerId, nativeId } : null;
}

export interface ProviderModelOption {
  id: string;
  label: string;
  type: 'embed' | 'answer';
}

export interface ProviderModels {
  provider: string;
  embed: ProviderModelOption[];
  answer: ProviderModelOption[];
}

/** Utility/ancillary models we never want to show as chat or embed options. */
const EXCLUDED_PATTERN =
  /(whisper|tts|speech|dall-e|sora|moderation|transcribe|transcription|reranker|rerank|ocr|vlm|clip|voice|audio|realtime|computer-use|embed-qa-guard|guard-?lm|image-|video-|diffusion|lyria|imagen|veo|synth|music|embedqa-guard)/i;

/** Heuristic: does the model id look like an embedding model? */
const EMBED_PATTERN = /(embed|embedqa|bge-|e5-|gte-|voyage-)/i;

const MAX_MODELS_PER_TYPE = 300;

function classifyOpenAiModelId(id: string | undefined | null): 'embed' | 'answer' | null {
  if (!id || typeof id !== 'string') return null;
  if (EXCLUDED_PATTERN.test(id)) return null;
  return EMBED_PATTERN.test(id) ? 'embed' : 'answer';
}

interface OpenAiModelsResponse {
  data?: Array<{ id?: string }>;
}

async function listOpenAiKind(provider: DynamicProvider, apiKey?: string): Promise<ProviderModelOption[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(`${provider.baseUrl}/models`, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${provider.label} returned ${response.status}${response.status === 401 || response.status === 403 ? ' (invalid or missing API key)' : ''}: ${body.slice(0, 200)}`);
  }
  const parsed = (await response.json()) as OpenAiModelsResponse;
  const out: ProviderModelOption[] = [];
  for (const entry of parsed.data ?? []) {
    const id = entry?.id;
    const type = classifyOpenAiModelId(id);
    if (!type || !id) continue;
    out.push({ id, label: id, type });
  }
  return out;
}

interface GeminiModelsResponse {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
}

async function listGeminiKind(provider: DynamicProvider, apiKey?: string): Promise<ProviderModelOption[]> {
  if (!apiKey) {
    throw new Error(`${provider.label} requires an API key to list models`);
  }
  const url = `${provider.nativeListingUrl}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${provider.label} returned ${response.status}${response.status === 401 || response.status === 403 ? ' (invalid API key)' : ''}: ${body.slice(0, 200)}`);
  }
  const parsed = (await response.json()) as GeminiModelsResponse;
  const out: ProviderModelOption[] = [];
  for (const model of parsed.models ?? []) {
    const id = model?.name?.replace(/^models\//, '');
    if (!id) continue;
    const methods = model?.supportedGenerationMethods ?? [];
    if (methods.includes('embedContent')) {
      out.push({ id, label: id, type: 'embed' });
    } else if (methods.includes('generateContent')) {
      if (!EXCLUDED_PATTERN.test(id)) {
        out.push({ id, label: id, type: 'answer' });
      }
    }
  }
  return out;
}

/**
 * Fetch a provider's model list using a user-supplied API key.
 * The key is used transiently for this request only — never stored.
 */
export async function listProviderModels(provider: DynamicProvider, apiKey?: string): Promise<ProviderModels> {
  const options =
    provider.listingKind === 'gemini'
      ? await listGeminiKind(provider, apiKey)
      : await listOpenAiKind(provider, apiKey);

  const embed = options
    .filter((m) => m.type === 'embed')
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, MAX_MODELS_PER_TYPE);
  const answer = options
    .filter((m) => m.type === 'answer')
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, MAX_MODELS_PER_TYPE);

  return { provider: provider.id, embed, answer };
}
