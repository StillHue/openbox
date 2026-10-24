import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createUserRepository } from '@openbox/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof import('@openbox/db').createDbClient>['db'];
  }
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt, stdlib only). Format: scrypt$N$r$p$saltHex$hashHex
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, n, r, p, salt, hashHex] = stored.split('$');
    if (algo !== 'scrypt' || !salt || !hashHex) return false;
    const derived = scryptSync(password, salt, KEY_LEN, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    const expected = Buffer.from(hashHex, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// JWT (HS256, stdlib only). Requires SESSION_SECRET.
// WARNING: NEVER use API_KEY as JWT secret - they must be separate keys.
// ---------------------------------------------------------------------------

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function jwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET must be set to sign tokens. Generate with: openssl rand -hex 64');
  }
  if (secret.length < 64) {
    console.warn('WARNING: SESSION_SECRET should be at least 64 characters for security');
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export interface TokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export function signToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub: userId, email, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', jwtSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const expected = createHmac('sha256', jwtSecret()).update(`${header}.${body}`).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Routes (public — used by the login screen)
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  name: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

const updateProfileSchema = z.object({
  name: z.string().max(100).nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

function toPublicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Resolve the caller's JWT session. The auth middleware has already rejected
 * unauthenticated requests, so an absent/invalid token here means the caller
 * authenticated with the master key or an `obk_` API key instead of a session
 * — those have no user to return.
 */
function sessionFromRequest(request: FastifyRequest): TokenPayload | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}

export async function authRoutes(fastify: FastifyInstance) {
  const repo = () => createUserRepository(fastify.db);

  // First-run check: true when no account exists yet (shows setup form).
  fastify.get('/auth/status', async () => {
    const count = await repo().count();
    return { setupRequired: count === 0 };
  });

  // Create an account. Open only for the very first user; afterwards
  // requires the master key (operator creates further accounts).
  fastify.post('/auth/register', async (request: FastifyRequest, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const existing = await repo().count();
    const masterKey = process.env.API_KEY;
    const authHeader = request.headers.authorization;
    const isMaster = !!masterKey && authHeader === `Bearer ${masterKey}`;
    if (existing > 0 && !isMaster) {
      return reply.code(403).send({ ok: false, error: 'Registration is closed' });
    }
    const { email, password, name } = parsed.data;
    const already = await repo().findByEmail(email);
    if (already) {
      return reply.code(409).send({ ok: false, error: 'Email already registered' });
    }
    const user = await repo().create({
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash: hashPassword(password),
    });
    return reply.code(201).send({ ok: true, token: signToken(user.id, user.email), user: toPublicUser(user) });
  });

  // Email + password login. Returns a JWT for subsequent requests.
  fastify.post('/auth/login', async (request: FastifyRequest, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body' });
    }
    const { email, password } = parsed.data;
    const user = await repo().findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ ok: false, error: 'Invalid email or password' });
    }
    return reply.send({ ok: true, token: signToken(user.id, user.email), user: toPublicUser(user) });
  });

  // Current session's account.
  fastify.get('/auth/me', async (request: FastifyRequest, reply) => {
    const session = sessionFromRequest(request);
    if (!session) {
      return reply.code(401).send({ ok: false, error: 'Not signed in' });
    }
    const user = await repo().findById(session.sub);
    if (!user) {
      return reply.code(404).send({ ok: false, error: 'Account not found' });
    }
    return reply.send({ ok: true, user: toPublicUser(user) });
  });

  // Update the display name. Email stays immutable here (it is the login id).
  fastify.patch('/auth/me', async (request: FastifyRequest, reply) => {
    const session = sessionFromRequest(request);
    if (!session) {
      return reply.code(401).send({ ok: false, error: 'Not signed in' });
    }
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const name = parsed.data.name?.trim() ? parsed.data.name.trim() : null;
    const user = await repo().updateProfile(session.sub, { name });
    if (!user) {
      return reply.code(404).send({ ok: false, error: 'Account not found' });
    }
    return reply.send({ ok: true, user: toPublicUser(user) });
  });

  // Change password. Requires the current one, and re-issues a token so the
  // caller keeps its session without logging in again.
  fastify.post('/auth/password', async (request: FastifyRequest, reply) => {
    const session = sessionFromRequest(request);
    if (!session) {
      return reply.code(401).send({ ok: false, error: 'Not signed in' });
    }
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error.flatten() });
    }
    const { currentPassword, newPassword } = parsed.data;
    const user = await repo().findById(session.sub);
    if (!user) {
      return reply.code(404).send({ ok: false, error: 'Account not found' });
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return reply.code(403).send({ ok: false, error: 'Current password is incorrect' });
    }
    await repo().updatePassword(user.id, hashPassword(newPassword));
    return reply.send({ ok: true, token: signToken(user.id, user.email), user: toPublicUser(user) });
  });
}
