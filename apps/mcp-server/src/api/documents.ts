import { API_BASE_URL, authHeaders } from '../config.js';
import type { DocumentListItem, DocumentStatus } from '../types.js';

export async function getDocumentStatus(documentId: string): Promise<DocumentStatus> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Document not found: ${documentId}`);
    }
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to get document';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<DocumentStatus>;
}

export async function listDocuments(limit = 50, offset = 0): Promise<DocumentListItem[]> {
  const response = await fetch(`${API_BASE_URL}/documents?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to list documents';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<DocumentListItem[]>;
}

export async function listBoxDocuments(boxId: string, limit = 50, offset = 0): Promise<DocumentListItem[]> {
  const response = await fetch(`${API_BASE_URL}/boxes/${boxId}/documents?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Box not found: ${boxId}`);
    }
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to list box documents';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<DocumentListItem[]>;
}

export interface UploadDocumentInput {
  boxId?: string;
  filename: string;
  content: string;
  mimeType?: string;
}

export interface UploadDocumentResponse {
  documentId: string;
  status: string;
}

export async function uploadDocument(input: UploadDocumentInput): Promise<UploadDocumentResponse> {
  const params = input.boxId ? `?boxId=${encodeURIComponent(input.boxId)}` : '';
  const form = new FormData();
  form.append(
    'file',
    new Blob([input.content], { type: input.mimeType ?? 'text/markdown' }),
    input.filename,
  );

  const response = await fetch(`${API_BASE_URL}/documents${params}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to upload document';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<UploadDocumentResponse>;
}
