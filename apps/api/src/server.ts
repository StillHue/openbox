import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { documentsRoutes } from './routes/documents.js';
import { queryRoutes } from './routes/query.js';
import { graphRoutes } from './routes/graph.js';
import { createQueue, closeQueue } from './queue.js';
import { createDbClient } from '@openbox/db';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

async function main() {
  // Register plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'OpenBox API',
        version: '1.0.0',
        description: 'Document ingestion and RAG API',
      },
      servers: [{ url: 'http://localhost:3000', description: 'Development server' }],
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Initialize database
  const dbConfig = {
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/openbox',
  };
  const dbClient = createDbClient(dbConfig);

  // Initialize queue
  const queue = createQueue();

  // Decorate fastify with db and queue
  fastify.decorate('db', dbClient.db);
  fastify.decorate('queue', queue);

  // Register routes
  await fastify.register(documentsRoutes);
  await fastify.register(queryRoutes);
  await fastify.register(graphRoutes);

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    await closeQueue();
    await dbClient.close();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();