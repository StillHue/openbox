import { API_BASE_URL, authHeaders } from '../config.js';
import type { GraphResponse, Node } from '../types.js';

export async function getGraph(documentId: string): Promise<GraphResponse> {
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to get graph';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<GraphResponse>;
}

export async function getNodeNeighbors(documentId: string, nodeId: string, depth = 1): Promise<GraphResponse> {
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}/nodes/${nodeId}/neighbors?depth=${depth}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to get neighbors';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<GraphResponse>;
}

export async function findPaths(documentId: string, sourceId: string, targetId: string, maxDepth = 3): Promise<Node[][]> {
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}/paths?source=${sourceId}&target=${targetId}&maxDepth=${maxDepth}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to find paths';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<Node[][]>;
}

export async function searchNodes(documentId: string, query: string, type?: string, limit = 20): Promise<Node[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (type) params.set('type', type);
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}/nodes/search?${params}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to search nodes';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<Node[]>;
}
