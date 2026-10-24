import { Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  createDbClient,
  ensureLightragColumns,
  createIngestRepository,
  createNodeRepository,
  createEdgeRepository,
  createBoxRepository,
} from "@openbox/db";
import {
  generateEmbedding,
  generateEmbeddings,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_ANSWER_MODEL,
  DEFAULT_JUDGE_MODEL,
  safeAnswerModel,
  safeEmbeddingModel,
  safeJudgeModel,
} from "@openbox/llm-provider";
import {
  convertToMarkdown,
  chunkMarkdown,
  isSupportedMimeType,
  type SupportedMimeType,
} from "@openbox/md-pipeline";
import { classifyDocument, calculateJudgeScore, type JudgeOutput } from "@openbox/judge";
import {
  extractGraphFromChunks,
  deduplicateNodes,
  type GraphExtraction,
  type GraphEdge,
  type GraphNode,
} from "@openbox/graph-engine";
import { unlinkSync, writeFileSync } from "fs";
import { IngestJobData } from "@openbox/shared-types";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
// Master key shared with the API (fly secret API_KEY). Sent on internal calls.
const apiKey = process.env.API_KEY;
const dbConfig = {
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/openbox",
};

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

connection.on("error", (err: Error) => {
  console.error("Redis connection error:", err);
});

const { db, close } = createDbClient(dbConfig);
const ingestRepo = createIngestRepository(db);
const nodeRepo = createNodeRepository(db);
const edgeRepo = createEdgeRepository(db);
const boxRepo = createBoxRepository(db);

async function downloadFile(documentId: string): Promise<Buffer> {
  const response = await fetch(`${apiBaseUrl}/documents/${documentId}/file`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download file: ${response.status} ${response.statusText}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function entityKey(type: string, name: string) {
  return `${type}:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

async function mergeGraphIntoBox(input: {
  boxId: string | null;
  documentId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  embeddingModel: string;
}) {
  const idByKey = new Map<string, string>();
  const toEmbed: Array<{ id: string; text: string }> = [];

  for (const node of input.nodes) {
    const description = (node.description ?? "").slice(0, 1500);
    const key = entityKey(node.type, node.name);
    if (input.boxId) {
      const existing = await nodeRepo.findInBox(input.boxId, node.type, node.name);
      if (existing) {
        const mergedDescription =
          existing.description && description && !existing.description.includes(description)
            ? `${existing.description}\n${description}`.slice(0, 1500)
            : existing.description || description;
        const properties = (existing.properties ?? {}) as Record<string, unknown>;
        const currentSources = Array.isArray(properties.sourceDocumentIds)
          ? properties.sourceDocumentIds.filter((value): value is string => typeof value === "string")
          : [];
        await nodeRepo.update(existing.id, {
          description: mergedDescription,
          properties: {
            ...properties,
            sourceDocumentIds: [...new Set([...currentSources, input.documentId])],
          },
        });
        idByKey.set(key, existing.id);
        toEmbed.push({ id: existing.id, text: `${node.type}: ${node.name}\n${mergedDescription}` });
        continue;
      }
    }

    const [created] = await nodeRepo.createMany([
      {
        documentId: input.documentId,
        boxId: input.boxId,
        type: node.type,
        name: node.name,
        description,
        properties: { sourceDocumentIds: [input.documentId] },
        confidence: node.confidence,
      },
    ]);
    if (!created) continue;
    idByKey.set(key, created.id);
    toEmbed.push({ id: created.id, text: `${node.type}: ${node.name}\n${description}` });
  }

  if (toEmbed.length > 0) {
    const vectors = await generateEmbeddings(
      toEmbed.map((item) => item.text),
      input.embeddingModel,
    );
    for (let index = 0; index < toEmbed.length; index += 1) {
      const vector = vectors[index];
      if (!vector) continue;
      await nodeRepo.update(toEmbed[index].id, { embedding: JSON.stringify(vector) });
    }
  }

  let edges = 0;
  for (const edge of input.edges) {
    const sourceId = idByKey.get(entityKey(edge.sourceType, edge.sourceName));
    const targetId = idByKey.get(entityKey(edge.targetType, edge.targetName));
    if (!sourceId || !targetId || sourceId === targetId) continue;
    if (input.boxId) {
      const existing = await edgeRepo.findInBox(input.boxId, sourceId, targetId, edge.type);
      if (existing) continue;
    }
    await edgeRepo.createMany([
      {
        documentId: input.documentId,
        boxId: input.boxId,
        sourceId,
        targetId,
        type: edge.type,
        properties: edge.properties ?? {},
        confidence: edge.confidence,
      },
    ]);
    edges += 1;
  }

  return { nodes: idByKey.size, edges };
}

async function processIngestJob(jobData: IngestJobData) {
  const { documentId, mimeType, originalName } = jobData;

  console.log(`Processing document ${documentId}...`);

  // Save to temp file for md-pipeline
  const tempFilePath = `/tmp/${documentId}-${originalName}`;

  try {
    // Download file from API (inside try so failures mark the
    // document as failed instead of leaving it stuck in pending)
    const fileBuffer = await downloadFile(documentId);
    writeFileSync(tempFilePath, fileBuffer);

    // Update status to processing
    await ingestRepo.updateDocumentStatus(documentId, "processing");

    // Resolve the box's models (falls back to defaults).
    let embeddingModel = DEFAULT_EMBEDDING_MODEL;
    let answerModel = DEFAULT_ANSWER_MODEL;
    let judgeModel = DEFAULT_JUDGE_MODEL;
    const doc = await ingestRepo.getDocument(documentId);
    if (doc?.boxId) {
      const box = await boxRepo.findById(doc.boxId);
      if (box) {
        embeddingModel = safeEmbeddingModel(box.embeddingModel);
        answerModel = safeAnswerModel(box.answerModel);
        judgeModel = safeJudgeModel(box.judgeModel ?? DEFAULT_JUDGE_MODEL);
      }
    }

    // 1. Convert to markdown
    console.log("Converting to markdown...");
    const supportedMimeType = isSupportedMimeType(mimeType)
      ? mimeType
      : "text/plain";
    const { markdown, metadata } = await convertToMarkdown(
      tempFilePath,
      supportedMimeType,
    );
    console.log(
      `Converted: ${metadata.wordCount} words, ${metadata.charCount} chars`,
    );

    // 2. Classify with judge (uses the box's judge model).
    // Degrades gracefully: if the LLM is rate-limited, the document still
    // completes without a judge score instead of failing outright.
    console.log(`Classifying document with judge ${judgeModel}...`);
    let judgeOutput: JudgeOutput = {
      category: 'other',
      language: 'other',
      quality: 'medium',
      topics: [],
      summary: '',
      confidence: 0,
      shouldIndex: true,
      reasoning: 'Judge skipped: LLM unavailable',
    };
    try {
      const result = await classifyDocument(markdown, answerModel, judgeModel);
      judgeOutput = result.output;
    } catch (err) {
      console.warn(`Judge failed for ${documentId}, continuing without score:`, (err as Error).message);
    }
    const judgeScore = calculateJudgeScore(judgeOutput);
    console.log(
      `Judge score: ${judgeScore}, category: ${judgeOutput.category}, shouldIndex: ${judgeOutput.shouldIndex}`,
    );

    // Update document with judge results
    await ingestRepo.updateDocumentStatus(
      documentId,
      "processing",
      judgeScore,
      judgeOutput,
    );

    if (!judgeOutput.shouldIndex) {
      await ingestRepo.updateDocumentStatus(documentId, "rejected", judgeScore, judgeOutput);
      try {
        unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
      console.log(`Document ${documentId} rejected by judge; nothing indexed`);
      return { success: true, chunksProcessed: 0, nodesProcessed: 0, edgesProcessed: 0 };
    }

    // 3. Chunk markdown
    console.log("Chunking markdown...");
    const chunkResults = await chunkMarkdown(markdown);
    console.log(`Created ${chunkResults.length} chunks`);

    // 4. Extract knowledge graph (uses the box's answer model).
    // Degrades gracefully: rate limits produce an empty graph, not a failure.
    console.log("Extracting knowledge graph...");
    let graphExtraction: GraphExtraction = { nodes: [], edges: [] };
    try {
      graphExtraction = await extractGraphFromChunks(
        chunkResults.map((c) => ({ content: c.content, chunkIndex: c.index })),
        answerModel,
      );
    } catch (err) {
      console.warn(`Graph extraction failed for ${documentId}, continuing empty:`, (err as Error).message);
    }
    console.log(
      `Extracted ${graphExtraction.nodes.length} nodes, ${graphExtraction.edges.length} edges`,
    );

    const dedupedNodes = deduplicateNodes(graphExtraction.nodes);
    const merged = await mergeGraphIntoBox({
      boxId: doc?.boxId ?? null,
      documentId,
      nodes: dedupedNodes,
      edges: graphExtraction.edges,
      embeddingModel,
    });
    console.log(`Merged ${merged.nodes} entities and ${merged.edges} relations into the box`);

    // 7. Generate embeddings for chunks
    console.log(`Generating embeddings with ${embeddingModel}...`);
    const chunkContents = chunkResults.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkContents, embeddingModel);
    console.log(`Generated ${embeddings.length} embeddings`);

    // 8. Save chunks with embeddings
    console.log("Saving chunks to database...");
    const chunksData = chunkResults.map((chunk, index) => ({
      content: chunk.content,
      chunkIndex: chunk.index,
      metadata: {
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        headings: chunk.headings,
        tokens: chunk.tokens,
      },
      embedding: JSON.stringify(embeddings[index]),
    }));

    await ingestRepo.saveChunks(documentId, chunksData);

    // 9. Update final status
    // Use 'rejected' when judge says not to index (pipeline succeeded but content rejected)
    // Use 'failed' only for actual processing errors
    const finalStatus = "completed";
    await ingestRepo.updateDocumentStatus(
      documentId,
      finalStatus,
      judgeScore,
      judgeOutput,
    );

    console.log(
      `Document ${documentId} processed successfully with status: ${finalStatus}`,
    );

    // Clean up temp file
    try {
      unlinkSync(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: true,
      chunksProcessed: chunkResults.length,
      nodesProcessed: merged.nodes,
      edgesProcessed: merged.edges,
    };
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    // Update status to failed
    await ingestRepo.updateDocumentStatus(documentId, "failed");

    // Clean up temp file
    try {
      unlinkSync(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }

    throw error;
  }
}

const graphReady = ensureLightragColumns(db).catch((error) => {
  console.error("Failed to ensure graph columns:", error);
  throw error;
});

const worker = new Worker(
  "ingest",
  async (job) => {
    await graphReady;
    const data = job.data as IngestJobData;
    return processIngestJob(data);
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 2,
      duration: 60000, // 2 jobs per minute max (free-tier friendly)
    },
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.close();
  await connection.quit();
  await close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("Worker started, waiting for jobs...");
