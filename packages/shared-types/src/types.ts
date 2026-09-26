/**
 * Shared TypeScript types for OpenBox
 */

export type IngestStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  boxId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  status: IngestStatus;
  judgeScore: number | null;
  judgeMetadata: JudgeMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JudgeMetadata {
  category: string;
  language: string;
  quality: 'high' | 'medium' | 'low';
  topics: string[];
  summary: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: ChunkMetadata;
  embedding: number[] | null;
  createdAt: Date;
}

export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  headings: string[];
  tokens: number;
}

export interface IngestJobData {
  documentId: string;
  filePath: string;
  mimeType: string;
  originalName: string;
}

export interface QueryRequest {
  query: string;
  topK: number;
  filter?: QueryFilter;
}

export interface QueryFilter {
  documentIds?: string[];
  categories?: string[];
}

export interface QueryResult {
  chunk: Chunk;
  score: number;
  document: Pick<Document, 'id' | 'filename' | 'originalName'>;
}

export interface QueryResponse {
  results: QueryResult[];
  query: string;
  tookMs: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DocumentUploadResponse {
  documentId: string;
  status: IngestStatus;
}

export interface DocumentStatusResponse extends Document {
  chunks?: Chunk[];
}

export interface Box {
  id: string;
  name: string;
  description: string | null;
  embeddingModel: string;
  answerModel: string;
  judgeModel: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBoxRequest {
  name: string;
  description?: string;
  embeddingModel?: string;
  answerModel?: string;
  judgeModel?: string;
}

export interface UpdateBoxRequest {
  name?: string;
  description?: string;
  embeddingModel?: string;
  answerModel?: string;
  judgeModel?: string;
}

export interface AskRequest {
  query: string;
  topK?: number;
}

export interface AskSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface AskResponse {
  answer: string;
  model: string;
  sources: AskSource[];
  query: string;
  tookMs: number;
}