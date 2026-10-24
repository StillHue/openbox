import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import { documentsRoutes } from "./routes/documents.js";
import { queryRoutes } from "./routes/query.js";
import { graphRoutes } from "./routes/graph.js";
import { boxesRoutes } from "./routes/boxes.js";
import { apiKeysRoutes, hashApiKey } from "./routes/api-keys.js";
import { authRoutes, verifyToken, jwtSecret } from "./routes/auth.js";
import { createQueue, closeQueue } from "./queue.js";
import { createDbClient, createApiKeyRepository, ensureLightragColumns } from "@openbox/db";

// Validate required secrets on startup
function validateRequiredSecrets() {
  const required: Record<string, string> = {
    SESSION_SECRET: process.env.SESSION_SECRET ?? '',
    API_KEY: process.env.API_KEY ?? '',
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    REDIS_URL: process.env.REDIS_URL ?? '',
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value || value.includes('your_') || value.includes('generate_'))
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`WARNING: Missing or default environment variables: ${missing.join(', ')}`);
    console.warn('This is UNSAFE for production. Please set proper values.');
  }

  // Validate SESSION_SECRET length
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 64) {
    console.warn('WARNING: SESSION_SECRET should be at least 64 characters for security');
  }

  // Validate API_KEY length
  if (process.env.API_KEY && process.env.API_KEY.length < 32) {
    console.warn('WARNING: API_KEY should be at least 32 characters for security');
  }
}

const fastify = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  },
});

// API Key authentication
const API_KEY = process.env.API_KEY;

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health, docs, and OpenAPI spec
  const publicPaths = [
    "/health",
    "/docs",
    "/docs/",
    "/docs/json",
    "/docs/yaml",
    "/auth/status",
    "/auth/register",
    "/auth/login",
  ];
  if (publicPaths.some((p) => request.url.startsWith(p))) {
    return;
  }

  const authHeader = request.headers.authorization;
  const providedKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  // Master key from env (operator-level)
  if (providedKey && API_KEY && providedKey === API_KEY) {
    return;
  }

  // Session JWT from email+password login (frontend)
  if (providedKey && providedKey.split('.').length === 3) {
    try {
      if (verifyToken(providedKey)) {
        return;
      }
    } catch {
      // No signing secret configured — fall through to the checks below
    }
  }

  // Per-user keys minted via POST /api-keys (obk_...)
  if (providedKey && providedKey.startsWith("obk_")) {
    try {
      const repo = createApiKeyRepository((request.server as any).db);
      const record = await repo.findValidByHash(hashApiKey(providedKey));
      if (record) {
        // Best-effort usage tracking; never block the request on it
        repo.touchLastUsed(record.id).catch(() => {});
        return;
      }
    } catch (err) {
      fastify.log.error({ err }, "API key lookup failed");
      return reply.code(500).send({ error: "Internal server error" });
    }
  }

  if (!API_KEY) {
    fastify.log.warn("API_KEY not set - authentication disabled");
    return;
  }

  if (!providedKey) {
    return reply
      .code(401)
      .send({ error: "Missing or invalid Authorization header" });
  }

  return reply.code(401).send({ error: "Invalid API key" });
}

async function main() {
  // Validate secrets on startup (development warning only)
  validateRequiredSecrets();

  // Register plugins
  // ALLOWED_ORIGINS: comma-separated list (e.g. "https://app.example.com").
  // SECURITY: Defaults to false (same-origin only) for security.
  // In development, you can use "*" but NEVER in production.
  const rawOrigins = (process.env.ALLOWED_ORIGINS ?? "").trim();
  
  // SECURITY FIX: Never allow all origins by default
  // If ALLOWED_ORIGINS is empty or "*" and we're in production, use false
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins =
    rawOrigins === "*"
      ? true  // Explicitly allowed (DANGEROUS in production)
      : rawOrigins === ""
        ? false  // SECURITY: Default to same-origin only
        : rawOrigins.split(",").map((o) => o.trim());
  
  // Warn about dangerous CORS configuration
  if (allowedOrigins === true && isProduction) {
    console.warn('WARNING: CORS is set to allow ALL origins (*) in production. This is a security risk.');
    console.warn('Set ALLOWED_ORIGINS to specific domains for production.');
  }

  await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    // SECURITY: Prevent sensitive headers from being exposed
    exposedHeaders: ["Content-Length", "Content-Type"],
  });

  // SECURITY: Rate limiting to prevent brute force and DoS attacks
  await fastify.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '15 minutes',
    keyGenerator: (req) => req.ip, // Rate limit by IP
  });

  // SECURITY: Stricter rate limiting for auth endpoints
  // We'll use a simple in-memory rate limiter for auth endpoints
  const authRateLimits = new Map<string, { count: number; timestamp: number }>();
  
  async function authRateLimiter(req: FastifyRequest, reply: FastifyReply) {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxRequests = 5;
    
    const record = authRateLimits.get(ip);
    if (record && now - record.timestamp < windowMs) {
      if (record.count >= maxRequests) {
        return reply.code(429).send({ error: 'Too many requests, please try again later' });
      }
      record.count++;
    } else {
      authRateLimits.set(ip, { count: 1, timestamp: now });
    }
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance per request
      const cleanupThreshold = now - windowMs;
      for (const [key, value] of authRateLimits.entries()) {
        if (value.timestamp < cleanupThreshold) {
          authRateLimits.delete(key);
        }
      }
    }
  }
  
  await fastify.register((instance, opts, done) => {
    instance.addHook('onRoute', (routeOptions) => {
      if (routeOptions.url === '/auth/login' || routeOptions.url === '/auth/register') {
        if (!routeOptions.preHandler) {
          routeOptions.preHandler = [];
        }
        (routeOptions.preHandler as any[]).push(authRateLimiter);
      }
    });
    done();
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "OpenBox API",
        version: "1.0.0",
        description: "Document ingestion and RAG API",
      },
      servers: [
        { url: "http://localhost:3000", description: "Development server" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "API Key",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list" },
  });

  // Authentication hook (runs before all routes)
  fastify.addHook("onRequest", authenticate);

  // Health check
  fastify.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  // Initialize database
  const dbConfig = {
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/openbox",
  };
  const dbClient = createDbClient(dbConfig);

  // Initialize queue
  const queue = createQueue();

  // Decorate fastify with db and queue
  fastify.decorate("db", dbClient.db);
  fastify.decorate("queue", queue);
  await ensureLightragColumns(dbClient.db);

  // Register routes
  await fastify.register(documentsRoutes);
  await fastify.register(queryRoutes);
  await fastify.register(graphRoutes);
  await fastify.register(boxesRoutes);
  await fastify.register(apiKeysRoutes);
  await fastify.register(authRoutes);

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info("Shutting down...");
    await closeQueue();
    await dbClient.close();
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start server
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
