import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { askBox, getBox, listBoxes } from '../api/boxes.js';
import { uploadDocument } from '../api/documents.js';

export function registerBoxTools(server: McpServer): void {
  server.tool(
    'list_boxes',
    'List all document boxes',
    {},
    async () => {
      try {
        const boxes = await listBoxes();

        if (boxes.length === 0) {
          return {
            content: [{ type: 'text', text: 'No boxes found.' }],
          };
        }

        const formatted = boxes.map((b, i) =>
          `${i + 1}. 📦 ${b.name} (${b.id})${b.description ? ` — ${b.description}` : ''}`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `Boxes (${boxes.length}):\n\n${formatted}` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing boxes: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_box',
    'Get a box by ID',
    {
      boxId: z.string().uuid().describe('The UUID of the box'),
    },
    async ({ boxId }) => {
      try {
        const box = await getBox(boxId);

        return {
          content: [
            {
              type: 'text',
              text: `Box: ${box.name} (${box.id})\nDescription: ${box.description ?? '-'}\nEmbedding: ${box.embeddingModel}\nAnswer: ${box.answerModel}\nJudge: ${box.judgeModel}\nCreated: ${box.createdAt}\nUpdated: ${box.updatedAt}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting box: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'ask_box',
    'Ask a question to a box (RAG over all its documents)',
    {
      boxId: z.string().uuid().describe('The UUID of the box'),
      query: z.string().min(1).max(2000).describe('The question'),
      topK: z.number().int().min(1).max(20).default(5).describe('Number of chunks to retrieve'),
    },
    async ({ boxId, query, topK }) => {
      try {
        const result = await askBox(boxId, query, topK);

        const sources = result.sources.map((s, i) =>
          `${i + 1}. (sim: ${s.similarity.toFixed(3)}) ${s.documentName} [chunk ${s.chunkIndex}]\n${s.content.slice(0, 400)}${s.content.length > 400 ? '...' : ''}`
        ).join('\n\n');
        const entities = (result.entities ?? [])
          .map((entity) => `- ${entity.type}: ${entity.name}${entity.description ? ` — ${entity.description}` : ''}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Answer (model ${result.model}, took ${result.tookMs}ms):\n${result.answer}\n\nEntities (${result.entities?.length ?? 0}):\n${entities || '-'}\n\nSources (${result.sources.length}):\n${sources}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error asking box: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'recall',
    'Recall an answer from a box using chunk search plus the entity graph',
    {
      boxId: z.string().uuid().describe('The UUID of the box'),
      query: z.string().min(1).max(2000).describe('What to recall'),
      topK: z.number().int().min(1).max(20).default(5).describe('Number of chunks to retrieve'),
    },
    async ({ boxId, query, topK }) => {
      try {
        const result = await askBox(boxId, query, topK);
        const sources = result.sources.map((source, index) =>
          `${index + 1}. ${source.documentName} [chunk ${source.chunkIndex}]`
        ).join('\n');
        const entities = (result.entities ?? [])
          .map((entity) => `- ${entity.type}: ${entity.name}`)
          .join('\n');
        const relations = (result.relations ?? [])
          .map((relation) => `- ${relation.sourceId} —${relation.type}→ ${relation.targetId}`)
          .join('\n');
        return {
          content: [{
            type: 'text',
            text: `${result.answer}\n\nEntities:\n${entities || '-'}\n\nRelations:\n${relations || '-'}\n\nSources:\n${sources || '-'}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error recalling: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'remember',
    'Save a markdown note into a box so the next ingest adds it to the brain',
    {
      boxId: z.string().uuid().describe('The UUID of the box'),
      title: z.string().min(1).max(120).describe('Note title, used as the filename'),
      content: z.string().min(1).max(20000).describe('Markdown content to remember'),
    },
    async ({ boxId, title, content }) => {
      try {
        const filename = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.md`;
        const result = await uploadDocument({
          boxId,
          filename,
          content,
          mimeType: 'text/markdown',
        });
        return {
          content: [{
            type: 'text',
            text: `Queued "${filename}" as ${result.documentId} (${result.status}). It becomes searchable after ingest completes.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error remembering: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
