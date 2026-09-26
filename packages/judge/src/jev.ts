import type { JudgeOutput } from './schema.js';
import type { ClassifyResult } from './classify.js';

const JEV_API_URL = process.env.TYPESAFE_API_URL ?? 'https://api.typesafe.ai/v1/systemone';
const JEV_MODEL = process.env.TYPESAFE_JEV_MODEL ?? 'jev-latest';

function jevApiKey(): string {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    throw new Error('TYPESAFE_API_KEY is not set');
  }
  return key;
}

interface JevAnswer {
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number;
}

interface JevResponse {
  answers?: Record<string, JevAnswer>;
}

function gateFromRequiredNouls(
  answers: Record<string, JevAnswer>,
  requiredIds: string[],
  { passAt = 0.8, failBelow = 0.5 } = {}
): { overall: 'pass' | 'review' | 'fail'; scores: Array<{ id: string; noul?: number }> } {
  const scores = requiredIds.map((id) => ({ id, noul: answers[id]?.noul }));
  if (scores.some((s) => typeof s.noul !== 'number')) {
    return { overall: 'review', scores };
  }
  if (scores.some((s) => (s.noul as number) < failBelow)) {
    return { overall: 'fail', scores };
  }
  if (scores.some((s) => (s.noul as number) < passAt)) {
    return { overall: 'review', scores };
  }
  return { overall: 'pass', scores };
}

/**
 * Judge a document with TypeSafe Jev (typed probabilities, no free text).
 * Returns a JudgeOutput compatible with calculateJudgeScore.
 */
export async function classifyWithJev(content: string): Promise<ClassifyResult> {
  const maxContentLength = 8000;
  const truncated = content.length > maxContentLength
    ? content.slice(0, maxContentLength) + '\n\n[TRUNCATED]'
    : content;

  const response = await fetch(JEV_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jevApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state: { document: truncated },
      questions: {
        indexable: {
          type: 'noul',
          instructions:
            'Is the document in `state.document` worth indexing for search/retrieval (real content, not boilerplate, placeholder, or noise)?',
          criteria: {
            true: 'Substantive content worth retrieving later',
            false: 'Placeholder, boilerplate, or noise with no retrieval value',
          },
        },
        high_quality: {
          type: 'noul',
          instructions:
            'Is the document in `state.document` well-structured, complete, and informative (high quality)?',
          criteria: {
            true: 'Well-structured, complete, informative',
            false: 'Fragmented, incomplete, or noisy',
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Jev API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const parsed = (await response.json()) as JevResponse;
  const answers = parsed.answers ?? {};
  const { overall, scores } = gateFromRequiredNouls(answers, ['indexable', 'high_quality']);

  const noulOf = (id: string): number => {
    const s = scores.find((x) => x.id === id);
    return typeof s?.noul === 'number' ? s.noul : 0.5;
  };

  const indexable = noulOf('indexable');
  const quality = noulOf('high_quality');
  const confidence = Math.round(((indexable + quality) / 2) * 100) / 100;

  const output: JudgeOutput = {
    category: 'other',
    language: 'other',
    quality: quality >= 0.8 ? 'high' : quality >= 0.5 ? 'medium' : 'low',
    topics: [],
    summary: '',
    confidence,
    shouldIndex: overall !== 'fail' && indexable >= 0.5,
    reasoning: `jev gate=${overall} indexable=${indexable} quality=${quality}`,
  };

  return {
    output,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };
}
