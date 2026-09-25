import { mistral } from '@ai-sdk/mistral';
import { generateObject } from 'ai';
import { judgeSchema, JudgeOutput, JUDGE_PROMPT } from './schema.js';

export interface ClassifyResult {
  output: JudgeOutput;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function classifyDocument(content: string): Promise<ClassifyResult> {
  // Truncate content if too long (keep first 15000 chars for classification)
  const maxContentLength = 15000;
  const truncatedContent = content.length > maxContentLength
    ? content.slice(0, maxContentLength) + '\n\n[TRUNCATED]'
    : content;

  const prompt = JUDGE_PROMPT.replace('{{content}}', truncatedContent);

  const result = await generateObject({
    model: mistral('mistral-large-latest'),
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