import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, queryApi, graphApi, boxesApi, modelsApi } from '../services/api';
import type { QueryRequest, Document, DocumentListResponse, GraphResponse, Node, CreateBoxRequest, UpdateBoxRequest, BoxGraph } from '../types';

// Helper to normalize API response - handles both array and object formats
export function useDocuments(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['documents', limit, offset],
    queryFn: () => documentsApi.list(limit, offset),
    select: (data): DocumentListResponse => {
      // Handle both formats: array or DocumentListResponse
      if (Array.isArray(data)) {
        return {
          documents: data,
          total: data.length,
          limit,
          offset,
        };
      }
      return data;
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, boxId }: { file: File; boxId?: string }) => documentsApi.upload(file, boxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useQuerySearch() {
  return useMutation({
    mutationFn: (request: QueryRequest) => queryApi.search(request),
  });
}

export function useGraph(documentId: string) {
  return useQuery({
    queryKey: ['graph', documentId],
    queryFn: () => graphApi.getGraph(documentId),
    enabled: !!documentId,
  });
}

export function useNeighbors(documentId: string, nodeId: string, depth = 1) {
  return useQuery({
    queryKey: ['neighbors', documentId, nodeId, depth],
    queryFn: () => graphApi.getNeighbors(documentId, nodeId, depth),
    enabled: !!documentId && !!nodeId,
  });
}

export function useSearchNodes(documentId: string, query: string, type?: string, limit = 20) {
  return useQuery({
    queryKey: ['searchNodes', documentId, query, type, limit],
    queryFn: () => graphApi.searchNodes(documentId, query, type, limit),
    enabled: !!documentId && !!query,
  });
}

export function useBoxes() {
  return useQuery({
    queryKey: ['boxes'],
    queryFn: () => boxesApi.list(),
  });
}

export function useBox(id: string) {
  return useQuery({
    queryKey: ['box', id],
    queryFn: () => boxesApi.get(id),
    enabled: !!id,
  });
}

export function useBoxDocuments(id: string) {
  return useQuery({
    queryKey: ['boxDocuments', id],
    queryFn: () => boxesApi.documents(id),
    enabled: !!id,
  });
}

export function useCreateBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBoxRequest) => boxesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
    },
  });
}

export function useUpdateBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoxRequest }) => boxesApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['box', variables.id] });
    },
  });
}

export function useDeleteBox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => boxesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
    },
  });
}

export function useAskBox() {
  return useMutation({
    mutationFn: ({ boxId, query, topK }: { boxId: string; query: string; topK?: number }) =>
      boxesApi.ask(boxId, query, topK),
  });
}

export function useModelCatalog() {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.catalog(),
    staleTime: 1000 * 60 * 10,
  });
}

/** Fetch a provider's live model list (API key used transiently). */
export function useProviderModels() {
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey?: string }) =>
      modelsApi.providerModels(provider, apiKey),
  });
}

export function useUnassignedDocuments() {
  return useQuery({
    queryKey: ['unassignedDocuments'],
    queryFn: () => documentsApi.listUnassigned(50, 0),
  });
}

export function useBoxGraph(id: string) {
  return useQuery({
    queryKey: ['boxGraph', id],
    queryFn: () => boxesApi.graph(id),
    enabled: !!id,
  });
}
