import { mistral } from '@ai-sdk/mistral';
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1FinishReason,
  LanguageModelV1Prompt,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider';
import { getAnswerModelInfo } from './models.js';
import { getDynamicProvider, parseDynamicModelId } from './providers.js';

const NIM_BASE_URL = process.env.NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';

function nvidiaApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error('NVIDIA_API_KEY is not set');
  }
  return key;
}

function messageText(content: string | Array<{ type: string; text?: string; result?: unknown }>): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => {
      if (part.type === 'text') return part.text ?? '';
      if (part.type === 'tool-result') return JSON.stringify(part.result);
      return '';
    })
    .join('');
}

function toOpenAiMessages(prompt: LanguageModelV1Prompt): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  for (const message of prompt) {
    if (message.role === 'system' || message.role === 'user' || message.role === 'assistant') {
      messages.push({ role: message.role, content: messageText(message.content) });
    } else if (message.role === 'tool') {
      messages.push({ role: 'user', content: messageText(message.content) });
    }
  }
  return messages;
}

function toFinishReason(reason: string | null | undefined): LanguageModelV1FinishReason {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'tool_calls':
    case 'function_call':
      return 'tool-calls';
    default:
      return 'other';
  }
}

interface NimChatResponse {
  choices: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

async function callOpenAiChat(
  baseURL: string,
  key: string,
  modelId: string,
  jsonMode: boolean,
  options: LanguageModelV1CallOptions
): Promise<{ text: string; promptTokens: number; completionTokens: number; finishReason: LanguageModelV1FinishReason }> {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: toOpenAiMessages(options.prompt),
      temperature: options.temperature ?? 0.1,
      ...(options.maxTokens != null ? { max_tokens: options.maxTokens } : {}),
      // OpenAI-compatible servers that honour this return the JSON object
      // directly instead of prose-wrapped-in-fences, which is what the
      // `extractJson` fallbacks in judge/graph-engine are there to clean up.
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: options.abortSignal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Chat API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const parsed = (await response.json()) as NimChatResponse;
  const choice = parsed.choices?.[0];
  return {
    text: choice?.message?.content ?? '',
    promptTokens: parsed.usage?.prompt_tokens ?? 0,
    completionTokens: parsed.usage?.completion_tokens ?? 0,
    finishReason: toFinishReason(choice?.finish_reason),
  };
}

/** Minimal OpenAI-compatible chat model (ai v4 LanguageModelV1). */
function createOpenAiChatModel(
  provider: string,
  baseURL: string,
  key: string,
  modelId: string,
  jsonMode: boolean
): LanguageModelV1 {
  const call = (options: LanguageModelV1CallOptions) => callOpenAiChat(baseURL, key, modelId, jsonMode, options);
  return {
    specificationVersion: 'v1',
    provider,
    modelId,
    defaultObjectGenerationMode: undefined,
    async doGenerate(options: LanguageModelV1CallOptions) {
      const result = await call(options);
      return {
        text: result.text,
        usage: {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
        },
        finishReason: result.finishReason,
        logprobs: undefined,
        rawCall: { rawPrompt: options.prompt, rawSettings: {} },
        rawResponse: { headers: {}, body: undefined },
        warnings: [],
      };
    },
    async doStream(options: LanguageModelV1CallOptions) {
      const result = await call(options);
      const parts: LanguageModelV1StreamPart[] = [
        { type: 'text-delta', textDelta: result.text },
        {
          type: 'finish',
          finishReason: result.finishReason,
          usage: {
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
          },
        },
      ];
      return {
        stream: new ReadableStream<LanguageModelV1StreamPart>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
        rawCall: { rawPrompt: options.prompt, rawSettings: {} },
      };
    },
  };
}

/** Resolve a box answer-model id to a Vercel AI SDK language model. */
export function resolveChatModel(modelId: string): LanguageModelV1 {
  const info = getAnswerModelInfo(modelId);

  // Dynamic provider model (`provider:nativeId`) — generic OpenAI-compatible chat.
  const dynamic = parseDynamicModelId(modelId);
  if (dynamic) {
    const provider = getDynamicProvider(dynamic.providerId);
    if (!provider) {
      throw new Error(`Unknown dynamic provider: ${dynamic.providerId}`);
    }
    const key = process.env[provider.keyEnv];
    if (!key) {
      throw new Error(`${provider.keyEnv} is not set (needed to chat with ${provider.label})`);
    }
    return createOpenAiChatModel(provider.id, provider.baseUrl, key, dynamic.nativeId, needsJsonTextMode(modelId));
  }

  if (info.provider === 'nvidia') {
    return createOpenAiChatModel('nim', NIM_BASE_URL, nvidiaApiKey(), info.id, needsJsonTextMode(modelId));
  }
  return mistral(info.id);
}

/** True when the model needs plain-text JSON mode (no structured-output support assumed). */
export function needsJsonTextMode(modelId: string): boolean {
  // Dynamic provider models go through the generic OpenAI-compatible path,
  // which has no structured-output support — always use plain-text JSON mode.
  if (parseDynamicModelId(modelId)) return true;
  return getAnswerModelInfo(modelId).provider !== 'mistral';
}
