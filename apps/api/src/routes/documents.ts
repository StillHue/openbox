import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { IngestJobData } from '@openbox/shared-types';
import { createIngestRepository } from '@openbox/db';
import * as fs from 'fs';

const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ level: 'info', msg, ...meta, time: new Date().toISOString() })),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ level: 'error', msg, ...meta, time: new Date().toISOString() })),
};

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof import('@openbox/db').createDbClient>['db'];
    queue: ReturnType<typeof import('../queue.js').createQueue>;
  }
}

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/documents',
    async (request: FastifyRequest, reply) => {
      try {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ error: 'No file provided' });
        }

        // Validate file
        const { filename, mimetype, encoding } = data;
        const buffer = await data.toBuffer();

        // Save file temporarily
        const tempFilePath = `/tmp/${uuidv4()}-${filename}`;
        fs.writeFileSync(tempFilePath, buffer);

        // Create document record
        const ingestRepo = createIngestRepository(fastify.db);
        const document = await ingestRepo.createDocument({
          filename,
          originalName: filename,
          mimeType: mimetype,
          status: 'pending',
        });

        // Enqueue ingestion job
        const queue = fastify.queue;
        const jobData: IngestJobData = {
          documentId: document.id,
          filePath: tempFilePath,
          mimeType: mimetype,
          originalName: filename,
        };

        await queue.add('ingest', jobData, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        });

        logger.info(`Document uploaded and job enqueued: ${document.id}`);

        return reply.code(202).send({
          documentId: document.id,
          status: 'pending',
        });
      } catch (error) {
        logger.error('Error uploading document:', { error: String(error) });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.get(
    '/documents/:id',
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const ingestRepo = createIngestRepository(fastify.db);
        const documentWithChunks = await ingestRepo.getDocument(id);

        if (!documentWithChunks) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        return reply.send(documentWithChunks);
      } catch (error) {
        logger.error('Error fetching document:', { error: String(error) });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.get(
    '/documents',
    async (request: FastifyRequest, reply) => {
      try {
        const query = request.query as { limit?: string; offset?: string };
        const limit = Number(query.limit) || 50;
        const offset = Number(query.offset) || 0;
        const ingestRepo = createIngestRepository(fastify.db);
        const documents = await ingestRepo.list(limit, offset);

        return reply.send(documents);
      } catch (error) {
        logger.error('Error listing documents:', { error: String(error) });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}