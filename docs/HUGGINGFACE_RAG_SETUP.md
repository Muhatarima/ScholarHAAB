# Hugging Face RAG setup

## 1. Environment

Copy the Hugging Face and Supabase variables from `.env.example` into
`.env.local`. The minimum required variables are:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HUGGINGFACE_API_KEY=
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_GENERATION_MODEL=google/flan-t5-large
HF_GENERATION_FALLBACK_MODEL=microsoft/phi-2
HF_ENABLE_DEMO_FALLBACK=true
HF_RETRY_ATTEMPTS=3
RAG_MATCH_THRESHOLD=0.7
```

Create the Hugging Face token with permission to call the free Inference API.
The app uses the classic model inference endpoint and retries failures with
exponential backoff. If Hugging Face is busy, `HF_ENABLE_DEMO_FALLBACK=true`
returns a deterministic local fallback instead of exposing provider errors to
students.

For OCR, the app calls `microsoft/trocr-large-printed` through the same Hugging
Face API. If OCR cannot read the image, the API returns a clear message asking
for a sharper image or typed question.

## 2. Database

Run this migration in the Supabase SQL editor:

```text
supabase/migrations/20260607_huggingface_documents_rag.sql
```

The migration creates:

- `documents` with `vector(384)`, full-text search, metadata, and source fields.
- `match_documents` with vector similarity threshold `0.7` and top-5 results.
- `hybrid_search_documents` using vector and keyword scores.
- `search_documents_keyword` as the embedding-service fallback.
- `profiles.setup_completed`.
- Optional per-user `conversations`.

Do not insert Gemini 768-dimensional embeddings into this table. Documents and
queries must both use `sentence-transformers/all-MiniLM-L6-v2`.

Confirm the migration is active by running this in the SQL editor:

```sql
select public.search_documents_keyword(
  query_text := 'kinematics',
  match_count := 1,
  filter := '{}'::jsonb
);
```

If PostgREST reports that this function is missing, the migration has not been
applied yet.

Also check the main vector RPC:

```sql
select proname
from pg_proc
where proname in ('match_documents', 'hybrid_search_documents', 'search_documents_keyword');
```

## 3. Past-paper files

Place source files under `data/past-papers/`, or pass another file/directory to
the ingestion command. Supported formats:

- `.txt`
- `.md`
- `.pdf` with a text layer
- `.json`
- `.jsonl`

Structured JSON records should include as many metadata fields as possible:

```json
{
  "board": "Cambridge",
  "level": "A Level",
  "subject": "Physics",
  "topic": "Kinematics",
  "year": 2024,
  "paper": "Paper 4",
  "question_number": "2(a)",
  "question_text": "A particle...",
  "mark_scheme": "Use v = u + at..."
}
```

## 4. Ingest

First inspect the detected files and chunk count:

```bash
npm run rag:ingest -- --input data/past-papers --dry-run
```

Then generate 384-dimensional embeddings and upload:

```bash
npm run rag:ingest -- --input data/past-papers --batch-size 16
```

The script uses 512 whitespace-token chunks with 50-token overlap. Existing
chunks are updated by `content_hash`, so rerunning is safe.

## 5. Local test

```bash
npm run dev
```

Test:

- `http://localhost:3000/solver`
- `http://localhost:3000/exam-mode`
- `http://localhost:3000/adaptive-mode`

Authenticated API requests require either the Supabase browser session cookie
or the bearer token automatically attached by the frontend.

The server also requires `SUPABASE_SERVICE_ROLE_KEY`. Retrieval deliberately
does not fall back to an anonymous Supabase client because RLS could otherwise
turn a configuration problem into a misleading empty-result response.

Useful direct endpoints:

```text
POST /api/explain
POST /api/solver
POST /api/exam-mode
POST /api/adaptive-mode
POST /api/ask
GET /api/auth/me
```

Every response includes retrieval mode, confidence, model, and source evidence.
When no document matches, the response is labelled
`AI_SYNTHESIS_NO_CORPUS_MATCH`; it never pretends a source was retrieved.
