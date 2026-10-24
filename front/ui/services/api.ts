import axios, { AxiosError } from 'axios';
import type {
  Document,
  DocumentListResponse,
  UploadResponse,
  QueryRequest,
  QueryResponse,
  GraphResponse,
  Node,
  ApiError,
  Box,
  CreateBoxRequest,
  UpdateBoxRequest,
  ModelCatalog,
  ProviderModelsResponse,
  AskResponse,
  BoxGraph,
  ApiKeyInfo,
  CreateApiKeyResponse,
  AuthLoginResponse,
  AuthStatusResponse,
  AuthUser,
} from '../types';

export const OPENBOX_AUTH_TOKEN_STORAGE_KEY = 'openbox.authToken';
const LEGACY_API_KEY_STORAGE_KEY = 'openbox.apiKey';

export function loadAuthToken(): string {
  if (typeof window === 'undefined') return '';
  const current = window.localStorage.getItem(OPENBOX_AUTH_TOKEN_STORAGE_KEY);
  if (current) return current;
  // One-time migration from the previous API-key storage.
  const legacy = window.localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY);
  if (legacy) {
    window.localStorage.setItem(OPENBOX_AUTH_TOKEN_STORAGE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
    return legacy;
  }
  return '';
}

export function saveAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(OPENBOX_AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(OPENBOX_AUTH_TOKEN_STORAGE_KEY);
  }
}

/** Backwards-compatible aliases (token replaced the raw key). */
export const OPENBOX_API_KEY_STORAGE_KEY = OPENBOX_AUTH_TOKEN_STORAGE_KEY;
export const loadOpenboxApiKey = loadAuthToken;
export const saveOpenboxApiKey = saveAuthToken;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the user's OpenBox API key (obk_...) to every request, when set.
api.interceptors.request.use((config) => {
  const key = loadOpenboxApiKey();
  if (key) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${key}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Expired/revoked key: drop it and bounce to login (browser only,
    // never from the login page itself to avoid redirect loops).
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login')
    ) {
      saveOpenboxApiKey('');
      window.location.href = '/login';
    }
    // Log full error for debugging
    console.error('API Error:', error);
    const message = error.response?.data?.error ?? error.message ?? 'An error occurred';
    // If we have more details from response data, include them
    if (error.response?.data) {
      const details = error.response.data;
      if (details.details) {
        return Promise.reject(new Error(`${message}\nDetails: ${JSON.stringify(details.details)}`));
      }
    }
    return Promise.reject(new Error(message));
  }
);

export const documentsApi = {
  list: (limit = 50, offset = 0) =>
    api.get<DocumentListResponse>(`/documents?limit=${limit}&offset=${offset}`).then((r) => r.data),

  listUnassigned: (limit = 50, offset = 0) =>
    api.get<Document[]>(`/documents?unassigned=true&limit=${limit}&offset=${offset}`).then((r) => r.data),

  get: (id: string) =>
    api.get<Document>(`/documents/${id}`).then((r) => r.data),

  upload: (file: File, boxId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = boxId ? `?boxId=${boxId}` : '';
    return api.post<UploadResponse>(`/documents${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  delete: (id: string) =>
    api.delete(`/documents/${id}`).then((r) => r.data),

  reprocess: (id: string) =>
    api.post<{ ok: boolean }>(`/documents/${id}/reprocess`).then((r) => r.data),
};

export const queryApi = {
  search: (request: QueryRequest) =>
    api.post<QueryResponse>('/query', request).then((r) => r.data),
};

export const graphApi = {
  getGraph: (documentId: string) =>
    api.get<GraphResponse>(`/graph/${documentId}`).then((r) => r.data),

  getNeighbors: (documentId: string, nodeId: string, depth = 1) =>
    api.get<GraphResponse>(`/graph/${documentId}/nodes/${nodeId}/neighbors?depth=${depth}`).then((r) => r.data),

  findPaths: (documentId: string, sourceId: string, targetId: string, maxDepth = 3) =>
    api.get<Array<Array<Node>>>(`/graph/${documentId}/paths?source=${sourceId}&target=${targetId}&maxDepth=${maxDepth}`).then((r) => r.data),

  searchNodes: (documentId: string, query: string, type?: string, limit = 20) => {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (type) params.set('type', type);
    return api.get<Node[]>(`/graph/${documentId}/nodes/search?${params}`).then((r) => r.data);
  },
};

export const boxesApi = {
  list: () =>
    api.get<Box[]>('/boxes').then((r) => r.data),

  get: (id: string) =>
    api.get<Box>(`/boxes/${id}`).then((r) => r.data),

  create: (data: CreateBoxRequest) =>
    api.post<Box>('/boxes', data).then((r) => r.data),

  update: (id: string, data: UpdateBoxRequest) =>
    api.patch<Box>(`/boxes/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/boxes/${id}`).then((r) => r.data),

  documents: (id: string, limit = 500) =>
    api.get<Document[]>(`/boxes/${id}/documents?limit=${limit}`).then((r) => r.data),

  ask: (id: string, query: string, topK = 5) =>
    api.post<AskResponse>(`/boxes/${id}/ask`, { query, topK }).then((r) => r.data),

  graph: (id: string) =>
    api.get<BoxGraph>(`/boxes/${id}/graph`).then((r) => r.data),
};

export const modelsApi = {
  catalog: () =>
    api.get<ModelCatalog>('/models').then((r) => r.data),

  /** Live model listing for a provider, using a user-supplied key (transient). */
  providerModels: (provider: string, apiKey?: string) =>
    api
      .post<ProviderModelsResponse>('/providers/models', { provider, apiKey })
      .then((r) => r.data),
};

export const apiKeysApi = {
  list: () =>
    api.get<ApiKeyInfo[]>('/api-keys').then((r) => r.data),

  create: (name: string) =>
    api.post<CreateApiKeyResponse>('/api-keys', { name }).then((r) => r.data),

  revoke: (id: string) =>
    api.delete(`/api-keys/${id}`).then((r) => r.data),
};

export const authApi = {
  /** First-run check: true when no account exists yet. Public. */
  status: () =>
    api.get<AuthStatusResponse>('/auth/status').then((r) => r.data),

  /** Create the first account (or with master key afterwards). Public. */
  register: (email: string, password: string, name?: string) =>
    api.post<AuthLoginResponse>('/auth/register', { email, password, name }).then((r) => r.data),

  /** Email + password login. Public. */
  login: (email: string, password: string) =>
    api.post<AuthLoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  /** The signed-in account. Requires a session JWT. */
  me: () => api.get<AuthLoginResponse>('/auth/me').then((r) => r.data),

  /** Update the display name. Email is immutable (it is the login id). */
  updateProfile: (name: string | null) =>
    api.patch<AuthLoginResponse>('/auth/me', { name }).then((r) => r.data),

  /** Change password; returns a fresh token so the session survives. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api
      .post<AuthLoginResponse>('/auth/password', { currentPassword, newPassword })
      .then((r) => r.data),
};

export default api;
