import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { createApiKeyRepository } from '@openbox/db';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof import('@openbox/db').createDbClient>['db'];
  }
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `obk_${randomBytes(24).toString('base64url')}`;
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, 12) };
}

function toPublic(key: {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}) {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
  };
}

export async function apiKeysRoutes(fastify: FastifyInstance) {
  const repo = () => createApiKeyRepository(fastify.db);

  // Mint a new key. The plaintext is returned ONCE — it cannot be recovered later.
  fastify.post('/api-keys', async (request: FastifyRequest, reply) => {
    const parsed = createApiKeySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const { plaintext, hash, prefix } = generateApiKey();
    const key = await repo().create({ name: parsed.data.name, keyHash: hash, keyPrefix: prefix });
    return reply.code(201).send({ ...toPublic(key), key: plaintext });
  });

  fastify.get('/api-keys', async () => {
    const keys = await repo().list();
    return keys.map(toPublic);
  });

  fastify.delete('/api-keys/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const key = await repo().revoke(id);
    if (!key) {
      return reply.code(404).send({ error: 'API key not found or already revoked' });
    }
    return reply.send({ revoked: true, ...toPublic(key) });
  });
}
