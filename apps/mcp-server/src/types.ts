export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  headings: string[];
  tokens: number;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: ChunkMetadata;
  embedding: number[] | null;
  createdAt: string;
}

export interface DocumentRef {
  id: string;
  filename: string;
  originalName: string;
}

export interface QueryResult {
  chunk: Chunk;
  score: number;
  document: DocumentRef;
}

export interface QueryResponse {
  results: QueryResult[];
  query: string;
  tookMs: number;
}

export interface DocumentStatus {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  judgeScore: number | null;
  judgeMetadata: {
    category: string;
    language: string;
    quality: 'high' | 'medium' | 'low';
    topics: string[];
    summary: string;
    confidence: number;
    shouldIndex: boolean;
    reasoning: string;
  } | null;
  chunks: Chunk[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  judgeScore: number | null;
  createdAt: string;
  updatedAt: string;
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

export interface Box {
  id: string;
  name: string;
  description: string | null;
  embeddingModel: string;
  answerModel: string;
  judgeModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AskSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface AskEntity {
  id: string;
  type: string;
  name: string;
  description: string | null;
}

export interface AskRelation {
  sourceId: string;
  targetId: string;
  type: string;
}

export interface AskResponse {
  answer: string;
  model: string;
  sources: AskSource[];
  entities?: AskEntity[];
  relations?: AskRelation[];
  query: string;
  tookMs: number;
}
