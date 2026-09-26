const NIM_BASE_URL = process.env.NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const NIM_MODEL_ID = process.env.NVIDIA_EMBED_MODEL ?? 'nvidia/nemotron-3-embed-1b';
const BATCH_SIZE = 32;

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error('NVIDIA_API_KEY is not set');
  }
  return key;
}

interface NimEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

/** Slice a native-dim vector to `dims` and L2-renormalize (per NVIDIA docs). */
export function sliceAndNormalize(vector: number[], dims: number): number[] {
  const sliced = vector.slice(0, dims);
  const norm = Math.sqrt(sliced.reduce((acc, v) => acc + v * v, 0));
  if (norm === 0) {
    throw new Error('Cannot normalize a zero vector');
  }
  return sliced.map((v) => v / norm);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${NIM_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: NIM_MODEL_ID, input: texts }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`NVIDIA NIM error ${response.status}: ${body.slice(0, 300)}`);
  }

  const parsed = (await response.json()) as NimEmbeddingResponse;
  if (!Array.isArray(parsed.data)) {
    throw new Error('Invalid NVIDIA NIM embedding response');
  }
  return [...parsed.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function generateNvidiaEmbeddings(texts: string[], effectiveDims: number): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = await embedBatch(texts.slice(i, i + BATCH_SIZE));
    for (const vec of batch) {
      out.push(vec.length === effectiveDims ? vec : sliceAndNormalize(vec, effectiveDims));
    }
  }
  return out;
}
