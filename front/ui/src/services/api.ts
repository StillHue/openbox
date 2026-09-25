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
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const message = error.response?.data?.error ?? error.message ?? 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const documentsApi = {
  list: (limit = 50, offset = 0) =>
    api.get<DocumentListResponse>(`/documents?limit=${limit}&offset=${offset}`).then((r) => r.data),

  get: (id: string) =>
    api.get<Document>(`/documents/${id}`).then((r) => r.data),

  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<UploadResponse>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  delete: (id: string) =>
    api.delete(`/documents/${id}`).then((r) => r.data),
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

export default api;