# @openbox/classifier

Original open-source implementation of **typed-judgment classification**:
small, composable units of machine opinion (`Noul` / `Choice` / `Score`)
with **code-owned gating**. MIT licensed.

> Design note: this package reimplements the publicly documented *ideas*
> (narrow questions, typed probabilities, gate-in-code) from scratch. It
> contains no TypeSafe code, and it is not affiliated with TypeSafe.
> `Noul` / `Choice` / `Score` are used here as generic primitive names.

## The contract

- **Code owns the workflow.** Code builds `state` (named fields, never a blob),
  asks one narrow question per claim, and combines answers into a verdict.
- **The model fills typed slots.** It returns probabilities and picks, never
  decisions. Prompts forbid inventing evidence: missing evidence pushes
  probabilities toward 0.5.
- **Confidence is concentration.** A `Choice.confidence` of 0.9 means a runaway
  winner, not proof the task is correct. Never gate a whole workflow on one
  Choice confidence.

## Usage

```ts
import { judge, gateFromRequiredNouls } from '@openbox/classifier';

const answers = await judge('nvidia/nemotron-3.5-lightning:free', {
  document: excerpt,
}, {
  indexable: {
    type: 'noul',
    instructions: 'Is this worth indexing for retrieval?',
    criteria: { true: 'Substantive content', false: 'Noise or placeholder' },
  },
});

const gate = gateFromRequiredNouls(answers, ['indexable']);
// gate.verdict: 'pass' | 'review' | 'fail'
```

Any chat model id understood by `@openbox/llm-provider` `resolveChatModel`
works (Mistral, NVIDIA NIM, OpenRouter, ...).

## Gate rules

| Verdict | Rule (defaults) |
| --- | --- |
| `pass` | every required noul `>= 0.8` |
| `review` | any required noul in `[0.5, 0.8)`, none `< 0.5` |
| `fail` | any required noul `< 0.5` |

Tune via `{ passAt, failBelow }`. Optional judgments are reported separately
and never flip the verdict. Exact-match checks (strings, ids) belong in
tests/grep, not in judgments.

## Logit readout (`logits.ts`)

For `Choice` questions, `judgeChoiceLogits` skips JSON generation: it asks
for a single option letter and reads P(option) from provider logprobs,
normalized over the allowed options only. One output token, no parsing,
distribution straight from next-token probabilities. Falls back to the
token-JSON path when the provider lacks logprob support.

## Shortlisting (`shortlist.ts`)

Large label sets share one embedding budget: rank every label by cosine
similarity first (`shortlistByCosine` / `shortlistWithEmbedder`), keep
top-k, and judge only the reduced set. Ideal before a box accumulates
hundreds of rules or documents.
