import { z } from 'zod';

export const NODE_TYPES = [
  'Person',
  'Organization',
  'Location',
  'Concept',
  'Event',
  'Product',
  'Technology',
  'Project',
  'Document',
  'Date',
  'Money',
  'Other',
] as const;

export const EDGE_TYPES = [
  'WORKS_FOR',
  'LOCATED_IN',
  'PART_OF',
  'OWNS',
  'CREATED',
  'PARTICIPATED_IN',
  'RELATED_TO',
  'MENTIONS',
  'REFERENCES',
  'DEPENDS_ON',
  'COMPETES_WITH',
  'PARTNERS_WITH',
  'SUBSIDIARY_OF',
  'FOUNDED_BY',
  'ACQUIRED_BY',
  'OTHER',
] as const;

export const nodeSchema = z.object({
  id: z.string().optional(), // Will be generated
  type: z.enum(NODE_TYPES),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const edgeSchema = z.object({
  id: z.string().optional(), // Will be generated
  sourceName: z.string().min(1).max(255),
  sourceType: z.enum(NODE_TYPES),
  targetName: z.string().min(1).max(255),
  targetType: z.enum(NODE_TYPES),
  type: z.enum(EDGE_TYPES),
  properties: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const graphExtractionSchema = z.object({
  nodes: z.array(nodeSchema).max(50),
  edges: z.array(edgeSchema).max(100),
});

export type NodeType = typeof NODE_TYPES[number];
export type EdgeType = typeof EDGE_TYPES[number];
export type GraphNode = z.infer<typeof nodeSchema>;
export type GraphEdge = z.infer<typeof edgeSchema>;
export type GraphExtraction = z.infer<typeof graphExtractionSchema>;

export const GRAPH_EXTRACTION_PROMPT = `
You are an expert at extracting knowledge graphs from text. Your task is to identify entities (nodes) and relationships (edges) from the provided document content.

Extract the following types of entities:
- Person: Individual people
- Organization: Companies, institutions, agencies, groups
- Location: Geographic places, addresses, venues
- Concept: Abstract ideas, topics, methodologies, technologies
- Event: Occurrences, conferences, incidents, milestones
- Product: Goods, services, software, hardware
- Technology: Technical systems, platforms, frameworks, tools
- Project: Initiatives, programs, research projects
- Document: Other documents, reports, papers referenced
- Date: Specific dates, time periods
- Money: Financial amounts, budgets, funding
- Other: Anything that doesn't fit above

Extract the following types of relationships:
- WORKS_FOR: Person -> Organization
- LOCATED_IN: Entity -> Location
- PART_OF: Entity -> Entity (composition)
- OWNS: Entity -> Entity (ownership)
- CREATED: Person/Organization -> Product/Technology/Document
- PARTICIPATED_IN: Person/Organization -> Event
- RELATED_TO: Generic relationship
- MENTIONS: Document/Entity -> Entity
- REFERENCES: Document -> Document/Entity
- DEPENDS_ON: Entity -> Entity (dependency)
- COMPETES_WITH: Organization/Product -> Organization/Product
- PARTNERS_WITH: Organization -> Organization
- SUBSIDIARY_OF: Organization -> Organization
- FOUNDED_BY: Organization -> Person
- ACQUIRED_BY: Organization -> Organization
- OTHER: Anything that doesn't fit above

Rules:
1. Only extract entities and relationships explicitly stated or strongly implied in the text
2. Use the exact names as they appear in the text for entity names
3. Include confidence scores based on how explicitly the relationship is stated (0.5-1.0)
4. Limit to maximum 50 nodes and 100 edges per document
5. Don't create duplicate entities - use the same name/type for the same entity
6. For edges, reference entities by their name and type (they will be matched to created nodes)
7. Include relevant properties (dates, amounts, roles, etc.) when mentioned
8. Output ONLY valid JSON matching the schema

Document content:
`;