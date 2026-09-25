import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, queryApi, graphApi } from '../services/api';
import type { QueryRequest } from '../types';

export function useDocuments(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['documents', limit, offset],
    queryFn: () => documentsApi.list(limit, offset),
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
    mutationFn: (file: File) => documentsApi.upload(file),
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