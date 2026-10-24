import { API_BASE_URL, authHeaders } from '../config.js';
import type { QueryResponse } from '../types.js';

export async function queryBase(baseId: string, question: string, topK = 10): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      query: question,
      topK,
      boxId: baseId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to query';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<QueryResponse>;
}
