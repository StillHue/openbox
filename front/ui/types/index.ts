export interface Document {
  id: string;
  boxId: string | null;
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
  boxId?: string;
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

export interface JudgeModelInfo {
  id: string;
  label: string;
  description: string;
  provider: string;
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

export interface ProviderInfo {
  id: string;
  label: string;
  capabilities: Array<'embed' | 'answer' | 'judge'>;
}

export interface DynamicProviderInfo {
  id: string;
  label: string;
  docsUrl: string;
  publicListing: boolean;
}

export interface ProviderModelOption {
  id: string;
  label: string;
  type: 'embed' | 'answer';
}

export interface ProviderModelsResponse {
  provider: string;
  embed: ProviderModelOption[];
  answer: ProviderModelOption[];
}

export interface EmbeddingModelInfo {
  id: string;
  label: string;
  dimensions: number;
  provider: string;
  nativeDimensions?: number;
}

export interface AnswerModelInfo {
  id: string;
  label: string;
  description: string;
  provider: string;
}

export interface ModelCatalog {
  providers: ProviderInfo[];
  dynamicProviders: DynamicProviderInfo[];
  embeddingModels: EmbeddingModelInfo[];
  answerModels: AnswerModelInfo[];
  judgeModels: JudgeModelInfo[];
  defaults: {
    embeddingModel: string;
    answerModel: string;
    judgeModel: string;
  };
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

export interface BoxGraphNode {
  id: string;
  name: string;
  mimeType: string;
  status: string;
  isRule: boolean;
}

export interface BoxGraphEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface BoxGraph {
  nodes: BoxGraphNode[];
  edges: BoxGraphEdge[];
}
