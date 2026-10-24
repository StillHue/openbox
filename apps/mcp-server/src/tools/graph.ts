import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findPaths, getGraph, getNodeNeighbors, searchNodes } from '../api/graph.js';

export function registerGraphTools(server: McpServer): void {
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
}
