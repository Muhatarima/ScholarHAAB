create extension if not exists vector;

create table if not exists public.rag_documents (
  id text primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  tier text not null default 'past_paper',
  retrieval_priority integer not null default 0,
  source_url text,
  source_title text,
  source_domain text,
  source_kind text,
  source_quality text,
  last_checked date,
  embedding vector(768),
  embedding_model text,
  embedding_dimensions integer,
  content_hash text,
  fts tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(source_title, '') || ' ' || coalesce(content, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rag_documents
  add column if not exists embedding_model text,
  add column if not exists embedding_dimensions integer,
  add column if not exists content_hash text;

create unique index if not exists rag_documents_content_hash_idx
  on public.rag_documents (content_hash)
  where content_hash is not null;

create index if not exists rag_documents_metadata_gin
  on public.rag_documents using gin (metadata);

create index if not exists rag_documents_fts_idx
  on public.rag_documents using gin (fts);

create index if not exists rag_documents_embedding_hnsw
  on public.rag_documents using hnsw (embedding vector_cosine_ops);

create or replace function public.match_rag_documents(
  query_embedding vector(768),
  query_text text default '',
  match_threshold double precision default 0.75,
  match_count integer default 5,
  filter jsonb default '{}'::jsonb
)
returns table (
  id text,
  content text,
  metadata jsonb,
  tier text,
  retrieval_priority integer,
  source_url text,
  source_title text,
  source_kind text,
  vector_similarity double precision,
  text_score double precision,
  similarity double precision
)
language sql
stable
as $$
  select
    d.id,
    d.content,
    d.metadata,
    d.tier,
    d.retrieval_priority,
    d.source_url,
    d.source_title,
    d.source_kind,
    1 - (d.embedding <=> query_embedding) as vector_similarity,
    case
      when nullif(trim(query_text), '') is null then 0::double precision
      else ts_rank_cd(d.fts, websearch_to_tsquery('english', query_text))::double precision
    end as text_score,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.rag_documents d
  where d.embedding is not null
    and d.embedding_model = 'gemini-embedding-001'
    and d.embedding_dimensions = 768
    and (filter = '{}'::jsonb or d.metadata @> filter)
    and 1 - (d.embedding <=> query_embedding) >= match_threshold
  order by
    d.embedding <=> query_embedding,
    d.retrieval_priority desc
  limit least(greatest(match_count, 1), 20);
$$;
