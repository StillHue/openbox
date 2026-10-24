<p align="center">
  <img src="front/assets/logos/02-versao-negativa.png" alt="OpenBox" width="400">
</p>

# OpenBox - Document Ingestion and RAG Pipeline

## Overview

OpenBox is a monorepo for document ingestion, processing, and retrieval-augmented generation (RAG). This implementation covers **Phase 1** of the development plan.

## Stack

- **Monorepo**: Turborepo + pnpm
- **Language**: TypeScript (Node.js 20+)
- **API**: Fastify
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL + pgvector
- **Embeddings**: NVIDIA NIM (Nemotron(Nemotron 33 EmbedEmbed 1B1B)
- **Answers**: OpenRouterOpenRouter (NemotronNemotron LightningLightning // NanoNano 30B30B)
- **Judging**: TypeSafe Jev or built-in classifier (per box)
- **Document Processing**: mammoth (docx), unpdf (pdf), remark/unified (markdown parsing)
- **UI**: Next.js (App Router) + shadcn/ui + Phosphor icons

## Project Structure

```
openbox/
├── apps/
│   ├── api/           # Fastify API server
│   └── worker/        # BullMQ worker for ingestion pipeline
├── packages/
│   ├── shared-types/  # Shared TypeScript types
│   ├── llm-provider/  # LLM wrapper (NVIDIA embeddings, OpenRouter answers)
│   ├── md-pipeline/   # Document conversion & chunking
│   ├── judge/         # Document classification (Jev + classifier dispatch)
│   ├── classifier/    # Open-source judge alternative (Noul/Choice/Score)
│   └── db/            # Drizzle ORM schema & client
├── front/
│   └── ui/            # Next.js management UI
├── docker-compose.yml
└── turbo.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 11+
- Docker & Docker Compose
- API keyskeys for desired providers (set via environment variables or UIdesired providers (set via environment variables or UI)

### 1. Clone and Install

```bash
# Install dependencies
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add API keys for providers you plan to use (e.g.,API keys for providers you plan to use (e.g., NVIDIA_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY,GROQ_API_KEY, etc.etc.)
```

### 3. Start Services

```bash
# Start PostgreSQL, Redis, API, and Worker
docker-compose up -d
```

### 4. Run Database Migrations

```bash
# Generate and run migrations
pnpm db:generate
pnpm db:migrate
```

### 5. Test the Pipeline

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

**Request**: `multipart/form-data` with `file` field

**Response**:
```json
{
  "documentId": "uuid",
  "status": "pending"
}
```

### GET /documents/:id
Get document status and chunks (if completed).

**Response**:
```json
{
  "id": "uuid",
  "filename": "doc.pdf",
  "originalName": "doc.pdf",
  "mimeType": "application/pdf",
  "status": "completed",
  "judgeScore": 0.85,
  "judgeMetadata": {...},
  "chunks": [...],
  "createdAt": "2024-...",
  "updatedAt": "2024-..."
}
```

### POST /query
Vector similarity search.

**Request**:
```json
{
  "query": "search query",
  "topK": 10,
  "documentIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "results": [
    {
      "chunk": {...},
      "score": 0.92,
      "document": {"id": "...", "filename": "...", "originalName": "..."}
    }
  ],
  "query": "search query",
  "tookMs": 45
```

### POST /providers/models
Fetch a provider's model list (used in the Orchestration tab).

**Request**:
```json
{
  "provider": "openrouter",
  "apiKey": "optional"
}
```

**Response**:
```json
{
  "provider": "openrouter",
  "embed": [
    { "id": "...", "label": "...", "type": "embed" },
    ...
  ],
  "answer": [
    { "id": "...", "label": "...", "type": "answer" },
    ...
  ]
}
```

## Ingestion Pipeline

The worker processes documents through this pipeline:

1. **Convert** → Markdown (PDF/DOCX/TXT)
2. **Classify** → Judge (Jev or classifier, per box) scores quality, category, topics
3. **Chunk** → Semantic chunking with heading context
4. **Embed** → NVIDIA NIM embeddings (1024 dimensions)
5. **Store** → PostgreSQL with pgvector index

## Development

### Run Locally (without Docker)

```bash
# Terminal 1: Start PostgreSQL + Redis
docker-compose up postgres redis

# Terminal 2: Run migrations
pnpm db:migrate

# Terminal 3: Start API
pnpm --filter @openbox/api dev

# Terminal 4: Start Worker
pnpm --filter @openbox/worker dev
```

### Build All Packages

```bash
pnpm build
```

### Lint All Packages

```bash
pnpm lint
```

## Supported File Types

| MIME Type | Extension | Description |
|-----------|-----------|-------------|
| `application/pdf` | .pdf | PDF documents |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx | Word documents |
| `text/plain` | .txt | Plain text |
| `text/markdown` | .md | Markdown |

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NVIDIA_API_KEY` | - | API key for NVIDIA NIM (embeddings, answers) |
| `OPENROUTER_API_KEY` | - | API key for OpenRouter (answers) |
| `GROQ_API_KEY` | - | API key for Groq (answers) |
| `DEEPSEEK_API_KEY` | - | API key for DeepSeek (answers) |
| `TOGETHER_API_KEY` | - | API key for Together AI (answers) |
| `XAI_API_KEY` | - | API key for xAI (answers) |
| `COHERE_API_KEY` | - | API key for Cohere (answers) |
| `GEMINI_API_KEY` | - | API key for Google Gemini (answers) |
| `FIREWORKS_API_KEY` | - | API key for Fireworks AI (answers) |
| `JINA_API_KEY` | - | API key for Jina AI (embeddings) |
| `JEV_API_KEY` | - | API key for Jev judging (if used) |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/openbox` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `PORT` | `3000` | API server port |

### Orchestration (account settings)

The **Settings → Orchestration** tab (account-level, not per box) lets you:

- Select a provider (12+ providers including NVIDIA NIM, OpenRouter, Groq,Groq, Together, etc.Together, etc.)
- Paste the provider API key (stored locally in the browser)
- Pick default models for each role:
  - **Embedding** — vectorization of documents and queries
  - **Answer** — the chat/completion model
  - **Judge** — quality gate: Jev (typed probabilities) or the built-in classifier (no extra API key, uses the box answer model)

Each box can still override the three models in its own **Settings** tab, scoped to that box only.

## Next Phases

- **Phase 2**: MCP Server for tool integration
- **Phase 3**: Graph-based retrieval (entity extraction + graphology)
- **Phase 4**: Hierarchical summarization
- **Phase 5**: Feedback loop & gap analysis
- **Phase 6**: Next.js management UI
- **Phase 7**: Production deployment (Vercel + Supabase + Upstash)

## License

MIT