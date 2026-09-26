import { mistral } from '@ai-sdk/mistral';
import { generateObject, generateText } from 'ai';
import { DEFAULT_ANSWER_MODEL, DEFAULT_JUDGE_MODEL, needsJsonTextMode, resolveChatModel } from '@openbox/llm-provider';
import { judgeDocument as judgeDocumentLocal } from '@openbox/classifier';
import { judgeSchema, JudgeOutput, JUDGE_PROMPT } from './schema.js';
import { classifyWithJev } from './jev.js';

export interface ClassifyResult {
  output: JudgeOutput;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function classifyDocument(
  content: string,
  modelId: string = DEFAULT_ANSWER_MODEL,
  judgeModelId: string = DEFAULT_JUDGE_MODEL
): Promise<ClassifyResult> {
  if (judgeModelId === 'jev-latest') {
    return classifyWithJev(content);
  }

  if (judgeModelId === 'classifier') {
    const verdict = await judgeDocumentLocal(modelId, content);
    const output: JudgeOutput = {
      category: 'other',
      language: 'other',
      quality: verdict.quality,
      topics: [],
      summary: '',
      confidence: verdict.confidence,
      shouldIndex: verdict.shouldIndex,
      reasoning: `classifier gate=${verdict.gate.verdict}`,
    };
    return {
      output,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
  // Truncate content if too long (keep first 15000 chars for classification)
  const maxContentLength = 15000;
  const truncatedContent = content.length > maxContentLength
    ? content.slice(0, maxContentLength) + '\n\n[TRUNCATED]'
    : content;

  const prompt = JUDGE_PROMPT.replace('{{content}}', truncatedContent);

  if (needsJsonTextMode(modelId)) {
    const { text, usage } = await generateText({
      model: resolveChatModel(modelId),
      prompt: `${prompt}\n\nRespond with a single JSON object only, no markdown fences, matching this schema: {"category": "technical" | "legal" | "financial" | "medical" | "academic" | "business" | "personal" | "other", "language": "pt" | "en" | "es" | "fr" | "de" | "other", "quality": "high" | "medium" | "low", "topics": string[3-10], "summary": string (2-3 sentences), "confidence": number 0-1, "shouldIndex": boolean, "reasoning": string}`,
      temperature: 0.1,
    });
    const parsed = judgeSchema.safeParse(extractJson(text));
    if (!parsed.success) {
      throw new Error(`Invalid judge JSON: ${parsed.error.message}`);
    }
    return {
      output: parsed.data,
      usage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      },
    };
  }

  const result = await generateObject({
    model: mistral('mistral-small-latest'),
    schema: judgeSchema,
    prompt,
    temperature: 0.1,
  });

  return {
    output: result.object,
    usage: {
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    },
  };
}

export function calculateJudgeScore(output: JudgeOutput): number {
  // Score based on quality, confidence, and shouldIndex
  const qualityScore = output.quality === 'high' ? 1.0 : output.quality === 'medium' ? 0.6 : 0.2;
  const confidenceScore = output.confidence;
  const indexScore = output.shouldIndex ? 1.0 : 0.0;

  // Weighted average
  return Math.round((qualityScore * 0.4 + confidenceScore * 0.3 + indexScore * 0.3) * 100) / 100;
}
