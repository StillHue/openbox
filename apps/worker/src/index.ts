import { Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  createDbClient,
  initializeDatabase,
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
  resolveEdges,
  generateNodeIds,
  type GraphExtraction,
} from "@openbox/graph-engine";
import { unlinkSync, writeFileSync } from "fs";
import { IngestJobData } from "@openbox/shared-types";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
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
  const response = await fetch(`${apiBaseUrl}/documents/${documentId}/file`);
  if (!response.ok) {
    throw new Error(
      `Failed to download file: ${response.status} ${response.statusText}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
    // NOTE: NVIDIA chat is not invokable on this account yet, so the
    // pipeline chat steps always use a supported Mistral model.
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

    // Deduplicate nodes and generate IDs
    const dedupedNodes = deduplicateNodes(graphExtraction.nodes);
    const nodesWithIds = generateNodeIds(dedupedNodes);
    console.log(`Deduplicated to ${nodesWithIds.length} unique nodes`);

    // 5. Save nodes
    console.log("Saving nodes to database...");
    const newNodes: Array<{
      documentId: string;
      type: string;
      name: string;
      description: string | undefined;
      properties: Record<string, unknown>;
      confidence: number;
    }> = nodesWithIds.map((n) => ({
      documentId,
      type: n.type,
      name: n.name,
      description: n.description,
      properties: n.properties ?? {},
      confidence: n.confidence,
    }));
    await nodeRepo.createMany(newNodes);
    console.log(`Saved ${newNodes.length} nodes`);

    // 6. Resolve and save edges
    console.log("Resolving and saving edges...");
    const resolvedEdges = resolveEdges(nodesWithIds, graphExtraction.edges);
    console.log(`Resolved ${resolvedEdges.length} edges`);

    const newEdges: Array<{
      documentId: string;
      sourceId: string;
      targetId: string;
      type: string;
      properties: Record<string, unknown>;
      confidence: number;
    }> = resolvedEdges.map((e) => ({
      documentId,
      sourceId: e.sourceId,
      targetId: e.targetId,
      type: e.edge.type,
      properties: e.edge.properties ?? {},
      confidence: e.edge.confidence,
    }));
    await edgeRepo.createMany(newEdges);
    console.log(`Saved ${newEdges.length} edges`);

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
    const finalStatus = judgeOutput.shouldIndex
      ? "completed"
      : "rejectedrejected";
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
      nodesProcessed: newNodes.length,
      edgesProcessed: newEdges.length,
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

const worker = new Worker(
  "ingest",
  async (job) => {
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
