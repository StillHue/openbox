import { mistral } from '@ai-sdk/mistral';
import { generateObject } from 'ai';
import { graphExtractionSchema, GRAPH_EXTRACTION_PROMPT, GraphExtraction, GraphNode, GraphEdge, NodeType, EdgeType } from './schema.js';

export async function extractGraphFromText(text: string): Promise<GraphExtraction> {
  const prompt = GRAPH_EXTRACTION_PROMPT + '\n\n' + text.slice(0, 15000); // Limit context

  const { object } = await generateObject({
    model: mistral('mistral-large-latest'),
    schema: graphExtractionSchema,
    prompt,
    temperature: 0.1,
    maxTokens: 4000,
  });

  return object;
}

export async function extractGraphFromChunks(chunks: Array<{ content: string; chunkIndex: number }>): Promise<GraphExtraction> {
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