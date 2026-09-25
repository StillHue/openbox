export interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  judgeScore: number | null;
  judgeMetadata: JudgeMetadata | null;
  createdAt: string;
  updatedAt: string;
  chunks?: Chunk[];
}

export interface JudgeMetadata {
  category: string;
  quality: string;
  topics: string[];
  shouldIndex: boolean;
  confidence: number;
  reasoning: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: ChunkMetadata;
  embedding: string | null;
  createdAt: string;
}

export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  headings: string[];
  tokens: number;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  limit: number;
  offset: number;
}

export interface UploadResponse {
  documentId: string;
  status: string;
}

export interface QueryRequest {
  query: string;
  topK?: number;
  documentIds?: string[];
}

export interface QueryResult {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: ChunkMetadata;
  similarity: number;
  document: {
    id: string;
    filename: string;
    originalName: string;
  };
}

export interface QueryResponse {
  results: QueryResult[];
  query: string;
  tookMs: number;
}

export interface Node {
  id: string;
  documentId: string;
  type: string;
  name: string;
  description: string | null;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: string;
}

export interface Edge {
  id: string;
  documentId: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: string;
}

export interface GraphResponse {
  nodes: Node[];
  edges: Edge[];
}

export interface PathNode {
  id: string;
  type: string;
  name: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}