import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryBase } from '../api/query.js';

export function registerQueryTools(server: McpServer): void {
  server.tool(
    'query_base',
    'Search completed documents in a box by vector similarity',
    {
      baseId: z.string().uuid().describe('The UUID of the box to query'),
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
}
