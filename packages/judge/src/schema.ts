import { z } from 'zod';

export const judgeSchema = z.object({
  category: z.enum([
    'technical',
    'legal',
    'financial',
    'medical',
    'academic',
    'business',
    'personal',
    'other',
  ]),
  language: z.enum(['pt', 'en', 'es', 'fr', 'de', 'other']),
  quality: z.enum(['high', 'medium', 'low']),
  topics: z.array(z.string()).min(1).max(10),
  summary: z.string().min(10).max(500),
  confidence: z.number().min(0).max(1),
  shouldIndex: z.boolean(),
  reasoning: z.string().min(10).max(1000),
});

export type JudgeOutput = z.infer<typeof judgeSchema>;

export const JUDGE_PROMPT = `Você é um classificador especialista de documentos. Analise o conteúdo do documento abaixo e forneça uma classificação estruturada.

REGRAS:
1. category: Classifique em uma das categorias: technical, legal, financial, medical, academic, business, personal, other
2. language: Identifique o idioma principal (pt, en, es, fr, de, other)
3. quality: Avalie a qualidade do conteúdo (high = bem estruturado, completo, informativo; medium = razoável; low = fragmentado, incompleto, ruído)
4. topics: Liste 3-10 tópicos principais extraídos do documento
5. summary: Resumo executivo de 2-3 frases (máx 500 chars)
6. confidence: Score de confiança 0-1
7. shouldIndex: true se o documento tem valor para busca/retrieval, false se é lixo/placeholder
8. reasoning: Justificativa breve da classificação (máx 1000 chars)

DOCUMENTO:
{{content}}

Responda APENAS com JSON válido seguindo o schema.`;