import type { AnswerMap, GateOptions, GateVerdict, NoulAnswer } from './types.js';

export interface NoulScore {
  id: string;
  p?: number;
}

export interface GateResult {
  verdict: GateVerdict;
  reason:
    | 'all_required_nouls_pass'
    | 'required_noul_below_pass'
    | 'required_noul_below_fail'
    | 'missing_required_answer';
  scores: NoulScore[];
}

function noulOf(answers: AnswerMap, id: string): number | undefined {
  const a = answers[id] as NoulAnswer | undefined;
  return typeof a?.p === 'number' ? a.p : undefined;
}

/**
 * Code-owned gate over required Noul judgments.
 *
 * - pass: every required noul >= passAt (default 0.8)
 * - review: any required noul in [failBelow, passAt), none below failBelow
 * - fail: any required noul < failBelow (default 0.5)
 *
 * Optional judgments are reported separately and never flip the verdict.
 * Never use a single broad Choice confidence as the primary gate: confidence
 * measures how peaked one distribution is, not whole-task correctness.
 */
export function gateFromRequiredNouls(
  answers: AnswerMap,
  requiredIds: string[],
  { passAt = 0.8, failBelow = 0.5 }: GateOptions = {}
): GateResult {
  const scores = requiredIds.map((id) => ({ id, p: noulOf(answers, id) }));
  if (scores.some((s) => typeof s.p !== 'number')) {
    return { verdict: 'review', reason: 'missing_required_answer', scores };
  }
  if (scores.some((s) => (s.p as number) < failBelow)) {
    return { verdict: 'fail', reason: 'required_noul_below_fail', scores };
  }
  if (scores.some((s) => (s.p as number) < passAt)) {
    return { verdict: 'review', reason: 'required_noul_below_pass', scores };
  }
  return { verdict: 'pass', reason: 'all_required_nouls_pass', scores };
}
