import { judge } from './judge.js';
import { gateFromRequiredNouls } from './gate.js';
import type { GateResult } from './gate.js';

export interface DocumentVerdict {
  shouldIndex: boolean;
  quality: 'high' | 'medium' | 'low';
  confidence: number;
  gate: GateResult;
}

/**
 * Document-quality preset: two Nouls (indexable, high-quality) combined
 * by the code-owned gate. Model-agnostic: pass any chat model id that
 * `resolveChatModel` understands.
 */
export async function judgeDocument(
  modelId: string,
  content: string,
  maxChars = 8000
): Promise<DocumentVerdict> {
  const truncated = content.length > maxChars ? content.slice(0, maxChars) + '\n\n[TRUNCATED]' : content;

  const answers = await judge(modelId, { document: truncated }, {
    indexable: {
      type: 'noul',
      instructions:
        'Is the document worth indexing for search/retrieval (real content, not boilerplate, placeholder, or noise)?',
      criteria: {
        true: 'Substantive content worth retrieving later',
        false: 'Placeholder, boilerplate, or noise with no retrieval value',
      },
    },
    high_quality: {
      type: 'noul',
      instructions: 'Is the document well-structured, complete, and informative?',
      criteria: {
        true: 'Well-structured, complete, informative',
        false: 'Fragmented, incomplete, or noisy',
      },
    },
  });

  const gate = gateFromRequiredNouls(answers, ['indexable', 'high_quality']);
  const p = (id: string) => {
    const a = answers[id];
    return a && 'p' in a && typeof a.p === 'number' ? a.p : 0.5;
  };
  const qualityP = p('high_quality');
  const confidence = Math.round(((p('indexable') + qualityP) / 2) * 100) / 100;

  return {
    shouldIndex: gate.verdict !== 'fail' && p('indexable') >= 0.5,
    quality: qualityP >= 0.8 ? 'high' : qualityP >= 0.5 ? 'medium' : 'low',
    confidence,
    gate,
  };
}
