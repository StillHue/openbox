# Status da sessão — Orchestration com providers dinâmicos

> Última atualização: 26/09/2026
> Escopo: aba **Orchestration** nas Settings da **conta** (`/settings`) — não da box.

## Objetivo

1. Mover a configuração de orquestração (provider, API key, modelos) para as **settings da conta**, não da box.
2. **Selector com vários providers**: o usuário seleciona um provider, cola a API key e o sistema **busca os modelos daquele provider ao vivo** (sem catálogo fixo). *"só isso"*.

## O que foi feito (concluído)

### 1. Registro de providers dinâmicos — `packages/llm-provider/src/providers.ts` (novo)

12 providers, todos com listing de modelos funcionando (verificado ao vivo):

| Provider | Listing sem key | Como lista |
|---|---|---|
| OpenRouter (multi-vendor) | ✅ público | OpenAI-compat |
| NVIDIA NIM | ✅ público | OpenAI-compat |
| Jina AI | ✅ público | OpenAI-compat |
| OpenAI | precisa key | OpenAI-compat |
| Mistral | precisa key | OpenAI-compat |
| Groq | precisa key | OpenAI-compat |
| DeepSeek | precisa key | OpenAI-compat |
| Together AI | precisa key | OpenAI-compat |
| xAI (Grok) | precisa key | OpenAI-compat |
| Cohere | precisa key | OpenAI-compat (compat endpoint) |
| Google Gemini | precisa key | endpoint **nativo** (`/v1beta/models?key=...`) |
| Fireworks AI | precisa key | OpenAI-compat |

- `listProviderModels(provider, apiKey)` — busca os modelos, classifica em **embed** (heurística: `embed|embedqa|bge-|e5-|gte-|voyage-`) e **answer**, filtra utilitários (whisper, tts, reranker, ocr, vlm, etc.), ordena, limita a 300 por tipo.
- `parseDynamicModelId("provider:nativeId")` — separa no **primeiro** `:` (funciona com ids tipo `openrouter:qwen/qwen3.8-27b:free`).

### 2. Endpoint novo — `POST /providers/models`

Em `apps/api/src/routes/boxes.ts`. Body: `{ provider, apiKey? }`.
- A key é usada **transientemente** (nunca guardada/logada).
- 400 sem key para provider privado; 502 com erro do provider.
- `GET /models` agora também retorna `dynamicProviders` (id, label, docsUrl, publicListing).

### 3. Roteamento de inferência por prefixo — modelos dinâmicos funcionam no pipeline

- `embed.ts`: ids `provider:nativeId` vão por **OpenAI-compat genérico** (`/embeddings`), com slice+renormalização L2 para 1024d (reusa `sliceAndNormalize` do nvidia.ts). Erro claro se o modelo tiver < 1024 dims.
- `chat.ts`: `resolveChatModel` roteia `provider:nativeId` para o base URL do registro com a env key correspondente. `needsJsonTextMode` = true para dinâmicos.
- `models.ts`: `isSupported*` e `get*ModelInfo` aceitam ids dinâmicos → criação/edição de box com modelos dinâmicos **passa na validação**.
- Chaves de inferência ficam nas **envs do servidor** (`.env.example` atualizado: `OPENAI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `TOGETHER_API_KEY`, `XAI_API_KEY`, `COHERE_API_KEY`, `GEMINI_API_KEY`, `FIREWORKS_API_KEY`, `JINA_API_KEY` — todas opcionais; `turbo.json` globalEnv atualizado).

### 4. Frontend

- `front/ui/types/index.ts`: `DynamicProviderInfo`, `ProviderModelOption`, `ProviderModelsResponse`; `ModelCatalog.dynamicProviders`.
- `front/ui/services/api.ts`: `modelsApi.providerModels(provider, apiKey)`.
- `front/ui/hooks/useApi.ts`: `useProviderModels()` (mutation).
- `front/ui/app/(main)/settings/page.tsx` — aba Orchestration refeita:
  1. **Provider** select (12 providers, com link "Get an API key")
  2. **API key** input (localStorage) + botão **Fetch**
  3. Modelos chegam e populam **Embedding** e **Answer** (armazenados como `provider:nativeId`), com campo de **filtro** para listas longas
  4. **Judge** continua estático (Jev / classifier)
  5. Persistência em localStorage (chaves + defaults) — sobrevive reload
- **New Box** (`boxes/page.tsx`): pré-seleciona os defaults da conta; mostra modelos dinâmicos como item mesmo fora do catálogo estático.
- **Box detail** (`boxes/[id]/page.tsx`): selects mostram o modelo dinâmico atual da box mesmo fora do catálogo estático.

### 5. Fixes de infra desta sessão

- `.dockerignore` com padrões `**/` (o `front/ui/.next` de **1.4 GB** estava indo ao builder; contexto caiu para ~150 KB, deploy de 40 min → ~1 min).
- Página da box corrompida (JSX truncado) reescrita; imports corrompidos em `graph/[id]/page.tsx` e `settings/page.tsx` corrigidos.
- README atualizado (stack + aba Orchestration).

### 6. Deploys (todos no ar)

- **API** (`openbox.fly.dev`): imagem `deployment-01M3EYT43B6H3CZMZEKC6TDJ7T` (212 MB) — `/models` retorna os 12 providers; `POST /providers/models` testado ao vivo: OpenRouter retornou **300 answer models sem key** ✅
- **Worker** (`openbox-worker`): imagem `deployment-01M3EYYSTC5NGX6ZZJF173E941`, 2 máquinas started (v23) ✅
- UI dev server rodando em `http://localhost:3000` (também na rede: `http://192.168.1.103:3000`).

## Onde parei exatamente

Terminei os deploys de API e worker e **validei o endpoint ao vivo via curl** (`POST /providers/models` com OpenRouter → 300 modelos). O build completo passa (11/11 tasks).

**Falta o teste no navegador** do novo fluxo da aba Orchestration (provider → colar key → Fetch → dropdowns populam → selecionar → criar box). Foi a próxima ação quando a sessão foi pausada para documentar.

## Pendências / próximos passos

1. **Testar no navegador** (`http://localhost:3000/settings` → Orchestration):
   - Selecionar OpenRouter → Fetch sem key → dropdowns populam
   - Selecionar um answer model → verificar persistência (reload)
   - Testar com key real de um provider privado (ex.: Groq/OpenAI)
2. **Testar embed no OpenRouter**: retornou `embed: 0` — OpenRouter pode não hospedar embeddings (a heurística pode ficar vazia; testar NVIDIA NIM/Jina que têm embedders reais).
3. **Teste end-to-end com modelo dinâmico**: criar box com `openrouter:...` como answer model, subir doc, perguntar — exige a env key correspondente no servidor (`fly secrets set OPENROUTER_API_KEY=...` já está configurado; outros providers precisam de secret).
4. Ajuste fino opcional: auto-fetch ao trocar de provider quando já há key salva; paginação/busca server-side para listas enormes.
5. Atualizar README com o novo fluxo (providers dinâmicos).
6. **Commit**: todo o trabalho desta e da sessão anterior está **não commitado** (`git status` mostra dezenas de arquivos).

## Decisões técnicas

- **Chave no browser vs servidor**: a key colada na UI serve **só para listar modelos** (fica no localStorage, transita para o endpoint sem ser armazenada). A **inferência** usa as env keys do servidor — documentado na própria UI.
- **Formato dos ids**: `provider:nativeId` (split no primeiro `:`). Ids legados do catálogo estático continuam válidos (retrocompatível com boxes existentes).
- **Embeddings**: qualquer modelo ≥ 1024 dims funciona (slice+normalização); < 1024 dá erro explícito. O índice pgvector é fixo em 1024d.
- **Judge**: continua Jev (typesafe) ou classifier (usa o answer model da box) — não vem do listing dinâmico.

## Como testar rápido (curl)

```bash
# Provider público — sem key
curl -X POST https://openbox.fly.dev/providers/models \
  -H 'Content-Type: application/json' \
  -d '{"provider":"openrouter"}'

# Provider privado — com key
curl -X POST https://openbox.fly.dev/providers/models \
  -H 'Content-Type: application/json' \
  -d '{"provider":"groq","apiKey":"gsk_..."}'

# Catálogo com os 12 providers
curl https://openbox.fly.dev/models
```
