# ScholarHAAB RAG setup

## Required environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
RAG_MATCH_THRESHOLD=0.75
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only secrets. Never
prefix them with `NEXT_PUBLIC_`.

## Database

Run `supabase/migrations/20260607_rag_documents_vector_search.sql` in the
Supabase SQL editor. This creates the canonical `rag_documents` table and the
`match_rag_documents` cosine-similarity RPC.

Documents and queries must use the same embedding model and dimensions. This
pipeline uses `gemini-embedding-001` with 768 dimensions. Existing MiniLM
embeddings must be re-indexed; matching Gemini query vectors against MiniLM
document vectors is invalid even when the vector lengths happen to match.

## Ingestion

Put JSON, JSONL, TXT, Markdown, or PDF source files under `data/`. Then run:

```powershell
npx ts-node --transpile-only scripts/ingest-pastpapers.ts --input data/cleaned_chunks.jsonl --limit 100
```

Remove `--limit 100` after validating the first batch. The script uses
approximately 512-token chunks with 20% overlap, creates Gemini document
embeddings, and upserts source metadata into `rag_documents`.

Dry-run input parsing without calling Gemini or Supabase:

```powershell
npx ts-node --transpile-only scripts/ingest-pastpapers.ts --input data/dataset_master.json --limit 10 --dry-run
```

## Runtime behavior

`POST /api/ask` authenticates the user, embeds the question, runs vector search
at the configured threshold, and sends the question, conversation history, and
retrieved chunks to the LLM. Confidence is the highest real cosine similarity.
When there is no vector match, the LLM answers from general academic knowledge
and the response is labeled at 40% rather than inventing a source.
