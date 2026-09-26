import { mistral } from '@ai-sdk/mistral';
import { generateObject, generateText } from 'ai';
import { DEFAULT_ANSWER_MODEL, needsJsonTextMode, resolveChatModel } from '@openbox/llm-provider';
import { graphExtractionSchema, GRAPH_EXTRACTION_PROMPT, GraphExtraction, GraphNode, GraphEdge, NodeType, EdgeType } from './schema.js';

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function extractGraphFromText(
  text: string,
  modelId: string = DEFAULT_ANSWER_MODEL
): Promise<GraphExtraction> {
  const prompt = GRAPH_EXTRACTION_PROMPT + '\n\n' + text.slice(0, 15000); // Limit context

  if (needsJsonTextMode(modelId)) {
    const { text: raw } = await generateText({
      model: resolveChatModel(modelId),
      prompt: `${prompt}\n\nRespond with a single JSON object only, no markdown fences, matching this schema: {"nodes": [{"type": one of Person, Organization, Location, Concept, Event, Product, Technology, Project, Document, Date, Money, Other, "name": string, "description"?: string, "confidence": number 0-1}], "edges": [{"sourceName": string, "sourceType": node type, "targetName": string, "targetType": node type, "type": one of WORKS_FOR, LOCATED_IN, PART_OF, OWNS, CREATED, PARTICIPATED_IN, RELATED_TO, MENTIONS, REFERENCES, DEPENDS_ON, COMPETES_WITH, PARTNERS_WITH, SUBSIDIARY_OF, FOUNDED_BY, ACQUIRED_BY, OTHER, "confidence": number 0-1}]}`,
      temperature: 0.1,
      maxTokens: 4000,
    });
    const parsed = graphExtractionSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      throw new Error(`Invalid graph JSON: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  const { object } = await generateObject({
    model: mistral('mistral-small-latest'),
    schema: graphExtractionSchema,
    prompt,
    temperature: 0.1,
    maxTokens: 4000,
  });

  return object;
}

export async function extractGraphFromChunks(
  chunks: Array<{ content: string; chunkIndex: number }>,
  modelId: string = DEFAULT_ANSWER_MODEL
): Promise<GraphExtraction> {
  // Combine chunks with overlap context
  const combinedText = chunks
    .map((c) => `[Chunk ${c.chunkIndex}]\n${c.content}`)
    .join('\n\n---\n\n');

  return extractGraphFromText(combinedText);
}

export function deduplicateNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Map<string, GraphNode>();

  for (const node of nodes) {
    const key = `${node.type}:${node.name.toLowerCase()}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, node);
    } else {
      // Merge: keep higher confidence, merge properties
      if (node.confidence > existing.confidence) {
        seen.set(key, {
          ...existing,
          confidence: node.confidence,
          description: node.description ?? existing.description,
          properties: { ...existing.properties, ...node.properties },
        });
      } else {
        seen.set(key, {
          ...existing,
          description: existing.description ?? node.description,
          properties: { ...node.properties, ...existing.properties },
        });
      }
    }
  }

  return Array.from(seen.values());
}

export function resolveEdges(nodes: GraphNode[], edges: GraphEdge[]): Array<{ sourceId: string; targetId: string; edge: GraphEdge }> {
  const nodeMap = new Map<string, GraphNode>();
  for (const node of nodes) {
    const key = `${node.type}:${node.name.toLowerCase()}`;
    nodeMap.set(key, node);
  }

  const resolved: Array<{ sourceId: string; targetId: string; edge: GraphEdge }> = [];

  for (const edge of edges) {
    const sourceKey = `${edge.sourceType}:${edge.sourceName.toLowerCase()}`;
    const targetKey = `${edge.targetType}:${edge.targetName.toLowerCase()}`;

    const sourceNode = nodeMap.get(sourceKey);
    const targetNode = nodeMap.get(targetKey);

    if (sourceNode && targetNode && sourceNode.id && targetNode.id) {
      resolved.push({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        edge,
      });
    } else {
      console.warn(`Could not resolve edge: ${sourceKey} --[${edge.type}]--> ${targetKey}`);
    }
  }

  return resolved;
}

export function generateNodeIds(nodes: GraphNode[]): GraphNode[] {
  return nodes.map((node, index) => ({
    ...node,
    id: node.id ?? `node-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }));
}
