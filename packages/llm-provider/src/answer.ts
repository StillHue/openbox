import { generateText } from 'ai';
import { DEFAULT_ANSWER_MODEL, getAnswerModelInfo } from './models.js';
import { resolveChatModel } from './chat.js';

export interface AnswerSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface GeneratedAnswer {
  answer: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const SYSTEM_PROMPT = `You are a helpful assistant answering questions using the provided document excerpts.
Rules:
- Answer ONLY based on the excerpts. If the excerpts do not contain the answer, say so clearly.
- Cite sources inline like [1], [2] matching the excerpt numbers.
- Be concise and direct. Respond in the same language as the question.
- Reply with plain prose text only. Never wrap the answer in JSON, code fences, or quotes.`;

export async function generateAnswer(
  query: string,
  sources: AnswerSource[],
  modelId: string = DEFAULT_ANSWER_MODEL,
  graphContext?: string
): Promise<GeneratedAnswer> {
  const info = getAnswerModelInfo(modelId);

  if (sources.length === 0) {
    return {
      answer: 'No relevant excerpts found in this box. Try another question or upload more documents.',
      model: info.id,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  const context = sources
    .map((s, i) => `[${i + 1}] (from "${s.documentName}")\n${s.content}`)
    .join('\n\n');
  const graphSection = graphContext
    ? `Knowledge graph context (use it to connect the excerpts; the excerpts remain the evidence):\n${graphContext}\n\n`
    : '';
  const prompt = `${graphSection}Excerpts:\n${context}\n\nQuestion: ${query}`;

  const result = await generateText({
    model: resolveChatModel(info.id),
    system: SYSTEM_PROMPT,
    prompt,
  });

  return {
    answer: unwrapJsonAnswer(result.text),
    model: info.id,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    },
  };
}

/** Models sometimes wrap the answer in JSON like {"answer": "..."}. Unwrap it. */
function unwrapJsonAnswer(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  if (!trimmed.startsWith('{')) return text;
  try {
    const parsed = JSON.parse(trimmed) as { answer?: unknown };
    return typeof parsed.answer === 'string' ? parsed.answer : text;
  } catch {
    return text;
  }
}
