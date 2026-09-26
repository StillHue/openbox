/**
 * Shortlisting for large choice sets (portable takeaway from local
 * typed-decision runtimes): when a question has hundreds of labels, score
 * every label with one embedding cosine first, keep top-k, and run the
 * expensive judgment only on the reduced set. Probabilities then range over
 * the kept labels only.
 */

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface ShortlistHit {
  label: string;
  score: number;
}

/**
 * Rank labels by cosine similarity of their embeddings to the state
 * embedding and keep the top `k`.
 */
export function shortlistByCosine(
  stateEmbedding: number[],
  labels: Array<{ label: string; embedding: number[] }>,
  k = 20
): ShortlistHit[] {
  return labels
    .map(({ label, embedding }) => ({
      label,
      score: Math.round(cosine(stateEmbedding, embedding) * 10000) / 10000,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}

/**
 * Embed state + labels with the provided embedder, then shortlist.
 * The embedder is injected so this stays runtime-agnostic
 * (Nemotron, Mistral, local encoder, ...).
 */
export async function shortlistWithEmbedder(
  embed: (texts: string[]) => Promise<number[][]>,
  state: string,
  labels: string[],
  k = 20
): Promise<ShortlistHit[]> {
  if (labels.length === 0) return [];
  const [stateEmbedding, ...labelEmbeddings] = await embed([state, ...labels]);
  return shortlistByCosine(
    stateEmbedding,
    labels.map((label, i) => ({ label, embedding: labelEmbeddings[i] })),
    k
  );
}
