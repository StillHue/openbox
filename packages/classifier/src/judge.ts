import { generateText } from 'ai';
import { z } from 'zod';
import { DEFAULT_ANSWER_MODEL, resolveChatModel } from '@openbox/llm-provider';
import type {
  AnswerMap,
  ChoiceAnswer,
  ChoiceQuestion,
  NoulAnswer,
  NoulQuestion,
  Question,
  ScoreAnswer,
  ScoreQuestion,
  StateMap,
} from './types.js';

const noulSchema = z.object({
  p: z.number().min(0).max(1),
  rationale: z.string().max(500).default(''),
});

const choiceSchema = z.object({
  pick: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(500).default(''),
});

const scoreSchema = z.object({
  level: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(500).default(''),
});

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

function renderState(state: StateMap): string {
  return Object.entries(state)
    .map(([key, value]) => {
      const rendered = typeof value === 'string' ? value : JSON.stringify(value);
      return `### ${key}\n${rendered}`;
    })
    .join('\n\n');
}

async function askJson<T>(modelId: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
  const { text } = await generateText({
    model: resolveChatModel(modelId),
    prompt: `${prompt}\n\nRespond with a single JSON object only, no markdown fences.`,
    temperature: 0.1,
  });
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new Error(`Invalid judgment JSON: ${parsed.error.message}`);
  }
  return parsed.data;
}

function askNoul(modelId: string, state: StateMap, id: string, q: NoulQuestion): Promise<NoulAnswer> {
  const prompt = [
    'Answer the yes/no question below with a probability P(true) between 0 and 1.',
    'Use ONLY the state. If the state does not contain the evidence, push the probability toward 0.5, never invent.',
    '',
    '## Instructions',
    q.instructions,
    '',
    '## Criteria',
    `- true (${q.criteria.true})`,
    `- false (${q.criteria.false})`,
    '',
    '## State',
    renderState(state),
    '',
    'JSON shape: {"p": number, "rationale": string}',
  ].join('\n');
  return askJson(modelId, prompt, noulSchema);
}

function askChoice(
  modelId: string,
  state: StateMap,
  id: string,
  q: ChoiceQuestion
): Promise<ChoiceAnswer> {
  const prompt = [
    'Pick exactly one option. `confidence` is the margin of the winner (1 = runaway winner, 0 = tie).',
    'Use ONLY the state. If nothing fits, pick the closest option and set confidence low.',
    '',
    '## Instructions',
    q.instructions,
    '',
    '## Options',
    ...q.options.map((o, i) => `${i + 1}. ${o}`),
    '',
    '## State',
    renderState(state),
    '',
    'JSON shape: {"pick": string (exact option text), "confidence": number, "rationale": string}',
  ].join('\n');
  return askJson(modelId, prompt, choiceSchema).then((a) => {
    if (!q.options.includes(a.pick)) {
      throw new Error(`Model picked unknown option: ${a.pick}`);
    }
    return a;
  });
}

function askScore(
  modelId: string,
  state: StateMap,
  id: string,
  q: ScoreQuestion
): Promise<ScoreAnswer> {
  const prompt = [
    'Place the subject on exactly one level. `confidence` is concentration around that level.',
    'Use ONLY the state.',
    '',
    '## Instructions',
    q.instructions,
    '',
    '## Levels (ordered)',
    ...q.levels.map((l, i) => `${i + 1}. ${l}`),
    '',
    '## State',
    renderState(state),
    '',
    'JSON shape: {"level": string (exact level text), "confidence": number, "rationale": string}',
  ].join('\n');
  return askJson(modelId, prompt, scoreSchema).then((a) => {
    if (!q.levels.includes(a.level)) {
      throw new Error(`Model picked unknown level: ${a.level}`);
    }
    return a;
  });
}

/**
 * Run a batch of questions against one model. Each question is independent;
 * failures throw (let the caller decide retry/fallback policy in code).
 */
export async function judge(
  modelId: string,
  state: StateMap,
  questions: Record<string, Question>
): Promise<AnswerMap> {
  const entries = Object.entries(questions);
  const answers: AnswerMap = {};
  for (const [id, q] of entries) {
    if (q.type === 'noul') answers[id] = await askNoul(modelId, state, id, q);
    else if (q.type === 'choice') answers[id] = await askChoice(modelId, state, id, q);
    else answers[id] = await askScore(modelId, state, id, q);
  }
  return answers;
}

/** Run with the default answer model. */
export function judgeDefault(state: StateMap, questions: Record<string, Question>): Promise<AnswerMap> {
  return judge(DEFAULT_ANSWER_MODEL, state, questions);
}

export type { NoulAnswer, ChoiceAnswer, ScoreAnswer };
