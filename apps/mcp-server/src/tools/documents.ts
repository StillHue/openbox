import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDocumentStatus, listBoxDocuments, listDocuments, uploadDocument } from '../api/documents.js';

const statusEmoji: Record<string, string> = {
  pending: '⏳',
  processing: '🔄',
  completed: '✅',
  failed: '❌',
};

export function registerDocumentTools(server: McpServer): void {
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
    'list_box_documents',
    'List documents in a box',
    {
      boxId: z.string().uuid().describe('The UUID of the box'),
      limit: z.number().int().min(1).max(100).default(50).describe('Maximum number of documents to return'),
      offset: z.number().int().min(0).default(0).describe('Number of documents to skip'),
    },
    async ({ boxId, limit, offset }) => {
      try {
        const docs = await listBoxDocuments(boxId, limit, offset);

        if (docs.length === 0) {
          return {
            content: [{ type: 'text', text: `No documents found in box ${boxId}.` }],
          };
        }

        const formatted = docs.map((d, i) =>
          `${offset + i + 1}. ${statusEmoji[d.status] ?? '❓'} ${d.originalName} (${d.id}) - ${d.status}`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `Documents in box ${boxId} (showing ${docs.length}, offset ${offset}):\n\n${formatted}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing box documents: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'upload_document',
    'Upload a text/markdown document, optionally into a box',
    {
      filename: z.string().min(1).max(255).describe('Filename, e.g. kadu.md'),
      content: z.string().min(1).max(100000).describe('Text content of the document'),
      boxId: z.string().uuid().optional().describe('Optional box UUID to assign the document to'),
      mimeType: z.string().max(100).default('text/markdown').describe('MIME type'),
    },
    async ({ filename, content, boxId, mimeType }) => {
      try {
        const result = await uploadDocument({ filename, content, boxId, mimeType });
        return {
          content: [
            {
              type: 'text',
              text: `Document uploaded: ${filename} → ${result.documentId} (status: ${result.status})${boxId ? ` in box ${boxId}` : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error uploading document: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
