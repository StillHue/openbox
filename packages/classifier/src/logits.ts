/**
 * Logit readout for Choice questions (inspired by logit-readout experiments
 * like SemIf/openjev): instead of asking the model to *write* probabilities
 * as JSON, ask for a single option token and read P(option) from the
 * provider-returned logprobs, normalized over the allowed options only.
 *
 * Faster (1 output token), no JSON parsing, and the distribution comes from
 * the model's own next-token probabilities rather than generated text.
 * Falls back to token-JSON mode when the provider lacks logprob support.
 */

export interface LogitChoiceResult {
  /** Normalized P(option) over the allowed options. */
  distribution: Record<string, number>;
  pick: string;
  /** Margin of the winner: concentration measure, 0..1. */
  confidence: number;
}

interface OpenAiChatResponse {
  choices: Array<{
    message?: { content?: string | null };
    logprobs?: { content?: Array<{ token: string; logprob: number }> | null } | null;
  }>;
}

function softmax(logprobs: number[]): number[] {
  const max = Math.max(...logprobs);
  const exps = logprobs.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function optionToken(option: string, index: number): string[] {
  // Accept letter answer ("A") or the raw option start as the scoring token.
  const letter = String.fromCharCode(65 + index);
  const firstWord = option.trim().split(/\s+/)[0] ?? option;
  return [letter, ` ${letter}`, firstWord, ` ${firstWord}`];
}

export async function judgeChoiceLogits(
  baseURL: string,
  apiKey: string,
  modelId: string,
  instructions: string,
  options: string[],
  state: string
): Promise<LogitChoiceResult> {
  const letters = options.map((_, i) => String.fromCharCode(65 + i)).join(', ');
  const prompt = [
    instructions,
    '',
    'Reply with exactly one letter, nothing else.',
    ...options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`),
    '',
    `State: ${state}`,
  ].join('\n');

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 1,
      logprobs: true,
      top_logprobs: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Logprob readout failed with status ${response.status}`);
  }

  const parsed = (await response.json()) as OpenAiChatResponse;
  const top = parsed.choices?.[0]?.logprobs?.content;
  if (!top || top.length === 0) {
    throw new Error('Provider did not return logprobs');
  }

  const byToken = new Map(top.map((t) => [t.token, t.logprob] as const));
  const scores = options.map((opt, i) => {
    const candidates = optionToken(opt, i)
      .map((t) => byToken.get(t))
      .filter((l): l is number => typeof l === 'number');
    if (candidates.length === 0) return Number.NEGATIVE_INFINITY;
    return Math.max(...candidates);
  });

  if (scores.every((s) => s === Number.NEGATIVE_INFINITY)) {
    throw new Error('No option token found in logprobs');
  }

  const finite = scores.map((s) => (s === Number.NEGATIVE_INFINITY ? -100 : s));
  const probs = softmax(finite);
  const distribution: Record<string, number> = {};
  options.forEach((o, i) => {
    distribution[o] = Math.round(probs[i] * 10000) / 10000;
  });

  let best = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[best]) best = i;
  }
  const runnerUp = Math.max(...probs.filter((_, i) => i !== best), 0);
  const confidence = Math.round((probs[best] - runnerUp) * 10000) / 10000;

  return { distribution, pick: options[best], confidence };
}
