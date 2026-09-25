import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE_URL = process.env.OPENBOX_API_URL ?? 'http://localhost:3000';

interface ChunkMetadata {
  startChar: number;
  endChar: number;
  headings: string[];
  tokens: number;
}

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: ChunkMetadata;
  embedding: number[] | null;
  createdAt: string;
}

interface DocumentRef {
  id: string;
  filename: string;
  originalName: string;
}

interface QueryResult {
  chunk: Chunk;
  score: number;
  document: DocumentRef;
}

interface QueryResponse {
  results: QueryResult[];
  query: string;
  tookMs: number;
}

interface DocumentStatus {
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

interface DocumentListItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  judgeScore: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Node {
  id: string;
  documentId: string;
  type: string;
  name: string;
  description: string | null;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: string;
}

interface Edge {
  id: string;
  documentId: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: string;
}

interface GraphResponse {
  nodes: Node[];
  edges: Edge[];
}

interface NodeWithEdges extends Node {
  edges: Edge[];
}

async function queryBase(baseId: string, question: string, topK = 10): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: question,
      topK,
      documentIds: [baseId],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to query';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<QueryResponse>;
}

async function getDocumentStatus(documentId: string): Promise<DocumentStatus> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`);

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

async function listDocuments(limit = 50, offset = 0): Promise<DocumentListItem[]> {
  const response = await fetch(`${API_BASE_URL}/documents?limit=${limit}&offset=${offset}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to list documents';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<DocumentListItem[]>;
}

async function getGraph(documentId: string): Promise<GraphResponse> {
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to get graph';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<GraphResponse>;
}

async function getNodeNeighbors(documentId: string, nodeId: string, depth = 1): Promise<GraphResponse> {
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}/nodes/${nodeId}/neighbors?depth=${depth}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to get neighbors';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<GraphResponse>;
}

async function findPaths(documentId: string, sourceId: string, targetId: string, maxDepth = 3): Promise<Node[][]> {
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}/paths?source=${sourceId}&target=${targetId}&maxDepth=${maxDepth}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to find paths';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<Node[][]>;
}

async function searchNodes(documentId: string, query: string, type?: string, limit = 20): Promise<Node[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (type) params.set('type', type);
  const response = await fetch(`${API_BASE_URL}/graph/${documentId}/nodes/search?${params}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Failed to search nodes';
    throw new Error(`API error: ${response.status} - ${errorMsg}`);
  }

  return response.json() as Promise<Node[]>;
}

const server = new McpServer({
  name: 'openbox',
  version: '1.0.0',
});

const statusEmoji: Record<string, string> = {
  pending: '⏳',
  processing: '🔄',
  completed: '✅',
  failed: '❌',
};

server.tool(
  'query_base',
  'Query a document base using vector similarity search',
  {
    baseId: z.string().uuid().describe('The UUID of the document base to query'),
    question: z.string().min(1).max(2000).describe('The question or search query'),
    topK: z.number().int().min(1).max(50).default(10).describe('Number of top results to return'),
  },
  async ({ baseId, question, topK }) => {
    try {
      const result = await queryBase(baseId, question, topK);

      if (result.results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No results found for query: "${question}"`,
            },
          ],
        };
      }

      const formattedResults = result.results.map((r, i) => {
        const chunk = r.chunk;
        const doc = r.document;
        const headings = chunk.metadata.headings.length > 0
          ? ` [${chunk.metadata.headings.join(' > ')}]`
          : '';

        return `${i + 1}. (score: ${r.score.toFixed(3)}) ${doc.originalName}${headings}\n${chunk.content.slice(0, 500)}${chunk.content.length > 500 ? '...' : ''}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${result.results.length} results for "${question}" (took ${result.tookMs}ms):\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error querying base: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_document_status',
  'Get the processing status and details of a specific document',
  {
    documentId: z.string().uuid().describe('The UUID of the document to check'),
  },
  async ({ documentId }) => {
    try {
      const doc = await getDocumentStatus(documentId);

      const chunksInfo = doc.chunks && doc.chunks.length > 0
        ? `\nChunks: ${doc.chunks.length} (first: ${doc.chunks[0].content.slice(0, 100)}...)`
        : '';

      const judgeInfo = doc.judgeScore !== null && doc.judgeMetadata
        ? `\nJudge Score: ${doc.judgeScore}/1.0\nCategory: ${doc.judgeMetadata.category}\nQuality: ${doc.judgeMetadata.quality}\nTopics: ${doc.judgeMetadata.topics.join(', ')}\nShould Index: ${doc.judgeMetadata.shouldIndex}`
        : '';

      return {
        content: [
          {
            type: 'text',
            text: `Document: ${doc.originalName} (${doc.filename})
Status: ${statusEmoji[doc.status] ?? '❓'} ${doc.status}${judgeInfo}${chunksInfo}
Created: ${doc.createdAt}
Updated: ${doc.updatedAt}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting document status: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'list_documents',
  'List all documents in the system with pagination',
  {
    limit: z.number().int().min(1).max(100).default(50).describe('Maximum number of documents to return'),
    offset: z.number().int().min(0).default(0).describe('Number of documents to skip'),
  },
  async ({ limit, offset }) => {
    try {
      const docs = await listDocuments(limit, offset);

      if (docs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No documents found.',
            },
          ],
        };
      }

      const formatted = docs.map((d, i) => {
        return `${offset + i + 1}. ${statusEmoji[d.status] ?? '❓'} ${d.originalName} (${d.id}) - ${d.status}`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Documents (showing ${docs.length}, offset ${offset}):\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing documents: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_graph',
  'Get the full knowledge graph for a document (nodes and edges)',
  {
    documentId: z.string().uuid().describe('The UUID of the document'),
  },
  async ({ documentId }) => {
    try {
      const graph = await getGraph(documentId);

      if (graph.nodes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No graph data found for document ${documentId}`,
            },
          ],
        };
      }

      const nodesFormatted = graph.nodes.map((n) =>
        `  • ${n.type}: ${n.name}${n.description ? ` — ${n.description}` : ''} (confidence: ${n.confidence.toFixed(2)})`
      ).join('\n');

      const edgesFormatted = graph.edges.map((e) => {
        const source = graph.nodes.find((n) => n.id === e.sourceId);
        const target = graph.nodes.find((n) => n.id === e.targetId);
        return `  • ${source?.name ?? e.sourceId} --[${e.type}]--> ${target?.name ?? e.targetId} (confidence: ${e.confidence.toFixed(2)})`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Knowledge Graph for document ${documentId}:\n\nNodes (${graph.nodes.length}):\n${nodesFormatted}\n\nEdges (${graph.edges.length}):\n${edgesFormatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting graph: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_node_neighbors',
  'Get neighboring nodes and edges for a specific node in the graph',
  {
    documentId: z.string().uuid().describe('The UUID of the document'),
    nodeId: z.string().uuid().describe('The UUID of the node'),
    depth: z.number().int().min(1).max(3).default(1).describe('Depth of neighbors to fetch'),
  },
  async ({ documentId, nodeId, depth }) => {
    try {
      const graph = await getNodeNeighbors(documentId, nodeId, depth);

      if (graph.nodes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No neighbors found for node ${nodeId} in document ${documentId}`,
            },
          ],
        };
      }

      const centerNode = graph.nodes.find((n) => n.id === nodeId);
      const otherNodes = graph.nodes.filter((n) => n.id !== nodeId);

      const nodesFormatted = [
        `Center: ${centerNode?.type}: ${centerNode?.name}${centerNode?.description ? ` — ${centerNode.description}` : ''}`,
        ...otherNodes.map((n) =>
          `  • ${n.type}: ${n.name}${n.description ? ` — ${n.description}` : ''} (confidence: ${n.confidence.toFixed(2)})`
        ),
      ].join('\n');

      const edgesFormatted = graph.edges.map((e) => {
        const source = graph.nodes.find((n) => n.id === e.sourceId);
        const target = graph.nodes.find((n) => n.id === e.targetId);
        return `  • ${source?.name ?? e.sourceId} --[${e.type}]--> ${target?.name ?? e.targetId} (confidence: ${e.confidence.toFixed(2)})`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Neighbors of node ${nodeId} (depth ${depth}):\n\nNodes:\n${nodesFormatted}\n\nEdges:\n${edgesFormatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting neighbors: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'find_paths',
  'Find paths between two nodes in the knowledge graph',
  {
    documentId: z.string().uuid().describe('The UUID of the document'),
    sourceId: z.string().uuid().describe('The UUID of the source node'),
    targetId: z.string().uuid().describe('The UUID of the target node'),
    maxDepth: z.number().int().min(1).max(5).default(3).describe('Maximum path depth to search'),
  },
  async ({ documentId, sourceId, targetId, maxDepth }) => {
    try {
      const paths = await findPaths(documentId, sourceId, targetId, maxDepth);

      if (paths.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No paths found between ${sourceId} and ${targetId} within depth ${maxDepth}`,
            },
          ],
        };
      }

      const pathsFormatted = paths.map((path, i) => {
        const nodeNames = path.map((n) => `${n.type}:${n.name}`).join(' → ');
        return `${i + 1}. ${nodeNames} (${path.length - 1} hops)`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${paths.length} path(s) between ${sourceId} and ${targetId} (max depth ${maxDepth}):\n\n${pathsFormatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error finding paths: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  'search_nodes',
  'Search for nodes in the knowledge graph by name or type',
  {
    documentId: z.string().uuid().describe('The UUID of the document'),
    query: z.string().min(1).max(200).describe('Search query (matches node name)'),
    type: z.string().optional().describe('Optional node type filter (e.g., Person, Organization, Concept)'),
    limit: z.number().int().min(1).max(100).default(20).describe('Maximum results to return'),
  },
  async ({ documentId, query, type, limit }) => {
    try {
      const nodes = await searchNodes(documentId, query, type, limit);

      if (nodes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No nodes found matching "${query}"${type ? ` of type ${type}` : ''}`,
            },
          ],
        };
      }

      const formatted = nodes.map((n, i) =>
        `${i + 1}. ${n.type}: ${n.name}${n.description ? ` — ${n.description}` : ''} (confidence: ${n.confidence.toFixed(2)})`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${nodes.length} node(s) matching "${query}"${type ? ` of type ${type}` : ''}:\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching nodes: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenBox MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});