# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenBox is a monorepo for document ingestion, processing, and retrieval-augmented generation (RAG) built with:
- **Monorepo**: Turborepo + pnpm
- **Language**: TypeScript (Node.js 22+)
- **API**: Fastify
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL + pgvector
- **LLM Provider**: Vercel AI SDK with Mistral (embeddings + classification)
- **Document Processing**: mammoth (docx), unpdf (pdf), remark/unified (markdown parsing)
- **Frontend**: React 18 + Vite + Tailwind + Radix UI + React Query + Cytoscape.js

## Repository Structure

```
openbox/
├── apps/
│   ├── api/           # Fastify API server (port 3000)
│   ├── worker/        # BullMQ worker for ingestion pipeline
│   └── mcp-server/    # MCP Server for tool integration
├── packages/
│   ├── shared-types/  # Shared TypeScript types
│   ├── llm-provider/  # LLM wrapper (Mistral embeddings)
│   ├── md-pipeline/   # Document conversion & chunking
│   ├── judge/         # Document classification via LLM
│   ├── graph-engine/  # Graph extraction & querying
│   └── db/            # Drizzle ORM schema & client
├── front/ui/          # React frontend
├── docker-compose.yml
└── turbo.json
```

## Common Commands

### Development
```bash
# Install dependencies
pnpm install

# Start all services (PostgreSQL, Redis, API, Worker, MCP Server)
pnpm docker:up

# Run database migrations
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Apply migrations
pnpm db:studio    # Open Drizzle Studio

# Run locally without Docker
# Terminal 1: Start PostgreSQL + Redis
docker-compose up postgres redis

# Terminal 2: Run migrations
pnpm db:migrate

# Terminal 3: Start API
pnpm --filter @openbox/api dev

# Terminal 4: Start Worker
pnpm --filter @openbox/worker dev

# Terminal 5: Start Frontend
pnpm --filter @openbox/ui dev
```

### Build & Lint
```bash
# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Build single package
pnpm --filter @openbox/api build
pnpm --filter @openbox/worker build
pnpm --filter @openbox/ui build
```

### Test Pipeline
```bash
# Health check
curl http://localhost:3000/health

# Upload a document
curl -X POST -F "file=@./test.pdf" http://localhost:3000/documents

# Check document status
curl http://localhost:3000/documents/{documentId}

# Query documents
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "your search query", "topK": 5}' \
  http://localhost:3000/query

# View API docs
open http://localhost:3000/docs
```

## API Endpoints

### POST /documents
Upload a document for ingestion.
- **Request**: `multipart/form-data` with `file` field
- **Response**: `{ documentId: "uuid", status: "pending" }`

### GET /documents/:id
Get document status and chunks (if completed).

### GET /documents
List documents with pagination (`?limit=50&offset=0`).

### POST /query
Vector similarity search.
- **Request**: `{ query: "search query", topK: 10, documentIds: ["uuid1", "uuid2"] }`
- **Response**: `{ results: [{ chunk, score, document }], query, tookMs }`

### Graph Endpoints
- `GET /graph/:documentId` - Full graph
- `GET /graph/:documentId/nodes/:nodeId/neighbors?depth=1` - Neighbors
- `GET /graph/:documentId/paths?source=...&target=...&maxDepth=3` - Paths
- `GET /graph/:documentId/nodes/search?query=...&type=...&limit=20` - Search nodes

## Ingestion Pipeline (Worker)

The worker processes documents through:
1. **Convert** → Markdown (PDF/DOCX/TXT/MD)
2. **Classify** → Judge LLM scores quality, category, topics, shouldIndex
3. **Chunk** → Semantic chunking with heading context
4. **Extract Graph** → Entities + relationships via LLM
5. **Embed** → Mistral embeddings (1024 dimensions)
6. **Store** → PostgreSQL with pgvector HNSW index

## Database Schema

Key tables:
- `documents` - Document metadata, status, judgeScore, judgeMetadata
- `chunks` - Document chunks with embeddings (JSON string for pgvector)
- `nodes` - Graph entities (Person, Organization, Location, Concept, Event, etc.)
- `edges` - Graph relationships (WORKS_FOR, LOCATED_IN, PART_OF, etc.)

Vector search uses a SQL function `vector_search(query_embedding vector(1024), match_count, filter_document_ids)` with HNSW index.

## Key Packages

### @openbox/db
- `createDbClient(config)` - Returns `{ db, client, close }`
- `createIngestRepository(db)` - Document + chunk operations
- `createQueryRepository(db)` - Vector search
- `createGraphRepository(db)` - Graph operations
- `createNodeRepository(db)`, `createEdgeRepository(db)` - Node/edge CRUD

### @openbox/llm-provider
- `generateEmbedding(text)` - Single embedding
- `generateEmbeddings(texts[])` - Batch embeddings
- Uses Mistral `mistral-embed` (1024 dimensions)

### @openbox/md-pipeline
- `convertToMarkdown(filePath, mimeType)` - PDF/DOCX/TXT/MD → Markdown
- `chunkMarkdown(markdown, options)` - Semantic chunking with heading context
- `isSupportedMimeType(mimeType)` - Type guard

### @openbox/judge
- `classifyDocument(markdown)` - Returns `{ output: JudgeOutput, usage }`
- `calculateJudgeScore(output)` - 0-1 score from quality/confidence/shouldIndex

### @openbox/graph-engine
- `extractGraphFromChunks(chunks[])` - LLM-based entity/relation extraction
- `deduplicateNodes(nodes[])` - Merge by type:name
- `resolveEdges(nodes[], edges[])` - Map edge names to node IDs
- `generateNodeIds(nodes[])` - Assign UUIDs

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_API_KEY` | - | Required for embeddings & classification |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/openbox` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `PORT` | `3000` | API server port |
| `HOST` | `0.0.0.0` | API server host |
| `VITE_API_URL` | `/api` | Frontend API base URL |

## Frontend Architecture

- **Routing**: React Router v6
- **State**: TanStack Query (React Query) for server state, Zustand for client state
- **UI**: Radix UI primitives + Tailwind CSS + class-variance-authority
- **Graph Viz**: Cytoscape.js with cose-bilkent/fcose layouts
- **API Client**: Axios with interceptors in `src/services/api.ts`

### Key Frontend Files
- `src/App.tsx` - Routes
- `src/hooks/useApi.ts` - React Query hooks
- `src/services/api.ts` - Axios API client
- `src/types/index.ts` - TypeScript interfaces

## Configuration Files

- `turbo.json` - Turborepo pipeline config (build, dev, lint, db tasks)
- `pnpm-workspace.yaml` - Workspace packages
- `tsconfig.json` - Base TS config with path aliases
- `docker-compose.yml` - Local services (postgres, redis, api, worker, mcp-server)
- `.env.example` - Environment template

## TypeScript Path Aliases

```json
"@openbox/shared-types": ["packages/shared-types/dist"],
"@openbox/llm-provider": ["packages/llm-provider/dist"],
"@openbox/md-pipeline": ["packages/md-pipeline/dist"],
"@openbox/judge": ["packages/judge/dist"],
"@openbox/db": ["packages/db/dist"]
```

Note: `noEmit: true` in root tsconfig - packages emit their own declarations via `tsc` in their build scripts.

## Development Notes

- All packages use `type: "module"` (ESM)
- Build output goes to `dist/` in each package
- Drizzle migrations live in `packages/db/migrations/`
- Worker concurrency: 2, rate limit: 5 jobs/minute
- File upload limit: 50MB
- Embedding model: Mistral `mistral-embed` (1024 dims)
- Judge model: Mistral `mistral-large-latest`
- Graph extraction model: Mistral `mistral-large-latest`