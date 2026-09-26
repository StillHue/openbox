import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IngestJobData } from '@openbox/shared-types';
import { createIngestRepository, createBoxRepository } from '@openbox/db';
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

        // Create document record first so the id is known
        const ingestRepo = createIngestRepository(fastify.db);
        const { boxId } = request.query as { boxId?: string };

        let boxIdValue: string | null = null;
        if (boxId !== undefined) {
          const box = await createBoxRepository(fastify.db).findById(boxId);
          if (!box) {
            return reply.code(400).send({ error: 'Box not found' });
          }
          boxIdValue = box.id;
        }

        const document = await ingestRepo.createDocument({
          boxId: boxIdValue,
          filename,
          originalName: filename,
          mimeType: mimetype,
          status: 'pending',
        });

        // Save file where GET /documents/:id/file expects it
        // (matches the /tmp/uploads volume mount on Fly)
        fs.mkdirSync('/tmp/uploads', { recursive: true });
        const tempFilePath = `/tmp/uploads/${document.id}-${filename}`;
        fs.writeFileSync(tempFilePath, buffer);

        // Enqueue ingestion job
        const queue = fastify.queue;
        const jobData: IngestJobData = {
          documentId: document.id,
          filePath: tempFilePath,
          mimeType: mimetype,
          originalName: filename,
        };

        await queue.add('ingest', jobData, {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 30000,
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
        const query = request.query as { limit?: string; offset?: string; boxId?: string; unassigned?: string };
        const limit = Number(query.limit) || 50;
        const offset = Number(query.offset) || 0;
        const ingestRepo = createIngestRepository(fastify.db);

        if (query.boxId !== undefined) {
          const documents = await ingestRepo.listByBox(query.boxId, limit, offset);
          return reply.send(documents);
        }

        if (query.unassigned === 'true') {
          const documents = await ingestRepo.listUnassigned(limit, offset);
          return reply.send(documents);
        }

        const documents = await ingestRepo.list(limit, offset);

        return reply.send(documents);
      } catch (error) {
        logger.error('Error listing documents:', { error: String(error) });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.delete(
    '/documents/:id',
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const ingestRepo = createIngestRepository(fastify.db);
        const document = await ingestRepo.getDocument(id);

        if (!document) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        // Remove file from disk (best effort)
        try {
          fs.unlinkSync(`/tmp/uploads/${id}-${document.filename}`);
        } catch {
          // Ignore missing files
        }

        // Cascades to chunks, nodes and edges
        await ingestRepo.deleteDocument(id);

        return reply.code(204).send();
      } catch (error) {
        logger.error('Error deleting document:', { error: String(error) });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Serve file content for worker download
  fastify.get(    '/documents/:id/file',
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const ingestRepo = createIngestRepository(fastify.db);
        const document = await ingestRepo.getDocument(id);

        if (!document) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        // File is stored in /tmp/uploads/{documentId}-{filename}
        const filePath = `/tmp/uploads/${id}-${document.filename}`;
        try {
          const file = await import('fs/promises').then(fs => fs.readFile(filePath));
          return reply.type(document.mimeType).send(file);
        } catch {
          return reply.code(404).send({ error: 'File not found on disk' });
        }
      } catch (error) {
        logger.error('Error serving document file:', { error: String(error) });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}