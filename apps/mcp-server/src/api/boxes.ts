import { API_BASE_URL, authHeaders } from '../config.js';
import type { AskResponse, Box } from '../types.js';

export async function listBoxes(): Promise<Box[]> {
  const response = await fetch(`${API_BASE_URL}/boxes`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to list boxes';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<Box[]>;
}

export async function getBox(boxId: string): Promise<Box> {
  const response = await fetch(`${API_BASE_URL}/boxes/${boxId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Box not found: ${boxId}`);
    }
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to get box';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<Box>;
}

export async function askBox(boxId: string, query: string, topK = 5): Promise<AskResponse> {
  const response = await fetch(`${API_BASE_URL}/boxes/${boxId}/ask`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ query, topK }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Box not found: ${boxId}`);
    }
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to ask box';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<AskResponse>;
}
