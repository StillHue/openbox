import { readFileSync } from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import * as mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'text/markdown';

export interface ConversionResult {
  markdown: string;
  metadata: ConversionMetadata;
}

export interface ConversionMetadata {
  originalMimeType: SupportedMimeType;
  pages?: number;
  wordCount: number;
  charCount: number;
}

const SUPPORTED_MIME_TYPES: SupportedMimeType[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

export function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
  return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

export async function convertToMarkdown(
  filePath: string,
  mimeType: SupportedMimeType
): Promise<ConversionResult> {
  switch (mimeType) {
    case 'application/pdf':
      return convertPdf(filePath);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return convertDocx(filePath);
    case 'text/plain':
    case 'text/markdown':
      return convertText(filePath);
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

async function convertPdf(filePath: string): Promise<ConversionResult> {
  const buffer = readFileSync(filePath);
  const result = await extractText(buffer, { mergePages: true });

  // unpdf returns { text: string | string[], totalPages: number }
  const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
  const markdown = text.trim();
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  return {
    markdown,
    metadata: {
      originalMimeType: 'application/pdf',
      pages: result.totalPages,
      wordCount,
      charCount: markdown.length,
    },
  };
}

async function convertDocx(filePath: string): Promise<ConversionResult> {
  const buffer = readFileSync(filePath);
  const { value: html } = await mammoth.convertToHtml({ buffer });

  // Convert HTML to markdown using unified
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify);

  // First parse HTML to mdast, then stringify to markdown
  // For simplicity, we'll use a basic HTML to markdown approach
  const markdown = htmlToMarkdown(html);
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  return {
    markdown,
    metadata: {
      originalMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      wordCount,
      charCount: markdown.length,
    },
  };
}

async function convertText(filePath: string): Promise<ConversionResult> {
  const content = readFileSync(filePath, 'utf-8');
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return {
    markdown: content,
    metadata: {
      originalMimeType: 'text/plain',
      wordCount,
      charCount: content.length,
    },
  };
}

function htmlToMarkdown(html: string): string {
  // Simple HTML to Markdown conversion
  // This is a basic implementation - could be enhanced with a proper library
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gi, (_, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
    })
    .replace(/<ol[^>]*>(.*?)<\/ol>/gi, (_, content) => {
      let index = 0;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${++index}. $1\n`) + '\n';
    })
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '') // Remove remaining tags
    .replace(/\n{3,}/g, '\n\n') // Normalize excessive newlines
    .trim();
}

export interface ChunkOptions {
  maxChunkSize?: number; // in tokens (approximate)
  overlap?: number; // overlap in tokens
}

export interface ChunkResult {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
  headings: string[];
  tokens: number;
}

const DEFAULT_CHUNK_SIZE = 500; // tokens
const DEFAULT_OVERLAP = 50; // tokens
const TOKENS_PER_CHAR = 0.25; // rough approximation

export async function chunkMarkdown(
  markdown: string,
  options: ChunkOptions = {}
): Promise<ChunkResult[]> {
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  // Parse markdown to AST
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const tree = processor.parse(markdown);

  // Extract headings and content sections
  const sections = extractSections(tree, markdown);

  // Chunk sections
  const chunks: ChunkResult[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionChunks = chunkSection(section, maxChunkSize, overlap, chunkIndex);
    chunks.push(...sectionChunks);
    chunkIndex += sectionChunks.length;
  }

  return chunks;
}

interface Section {
  heading: string;
  level: number;
  content: string;
  startChar: number;
  endChar: number;
  headings: string[]; // Full heading path
}

function extractSections(tree: any, markdown: string): Section[] {
  const sections: Section[] = [];
  let currentHeadingPath: string[] = [];
  let lastEnd = 0;

  function visit(node: any, depth: number = 0) {
    if (node.type === 'heading') {
      const headingText = node.children
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.value)
        .join('');

      // Update heading path
      currentHeadingPath = currentHeadingPath.slice(0, node.depth - 1);
      currentHeadingPath.push(headingText);

      // Create section for previous content if any
      if (lastEnd < (node.position?.start?.offset ?? 0)) {
        sections.push({
          heading: currentHeadingPath[currentHeadingPath.length - 1] ?? '',
          level: node.depth,
          content: markdown.slice(lastEnd, node.position?.start?.offset ?? 0),
          startChar: lastEnd,
          endChar: node.position?.start?.offset ?? 0,
          headings: [...currentHeadingPath],
        });
      }

      lastEnd = node.position?.end?.offset ?? 0;
    }

    if (node.children) {
      for (const child of node.children) {
        visit(child, depth + 1);
      }
    }
  }

  visit(tree);

  // Add final section
  if (lastEnd < markdown.length) {
    sections.push({
      heading: currentHeadingPath[currentHeadingPath.length - 1] ?? '',
      level: 1,
      content: markdown.slice(lastEnd),
      startChar: lastEnd,
      endChar: markdown.length,
      headings: [...currentHeadingPath],
    });
  }

  return sections.filter((s) => s.content.trim().length > 0);
}

function chunkSection(
  section: Section,
  maxChunkSize: number,
  overlap: number,
  startIndex: number
): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const content = section.content.trim();
  const words = content.split(/\s+/);
  const approximateTokens = words.length * 1.3; // rough token estimate

  if (approximateTokens <= maxChunkSize) {
    chunks.push({
      content: section.content,
      index: startIndex,
      startChar: section.startChar,
      endChar: section.endChar,
      headings: section.headings,
      tokens: Math.round(approximateTokens),
    });
    return chunks;
  }

  // Split into chunks with overlap
  let currentIndex = startIndex;
  let charOffset = section.startChar;

  for (let i = 0; i < words.length; i += maxChunkSize - overlap) {
    const chunkWords = words.slice(i, i + maxChunkSize);
    const chunkContent = chunkWords.join(' ');
    const chunkTokens = Math.round(chunkWords.length * 1.3);
    const chunkCharLength = chunkContent.length;

    chunks.push({
      content: chunkContent,
      index: currentIndex++,
      startChar: charOffset,
      endChar: charOffset + chunkCharLength,
      headings: section.headings,
      tokens: chunkTokens,
    });

    charOffset += chunkCharLength - Math.round(overlap * (1 / TOKENS_PER_CHAR));
  }

  return chunks;
}

export function countTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 chars for English, 1 token ≈ 3 chars for Portuguese
  // Using 0.25 tokens per char as a conservative estimate
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}