create extension if not exists vector with schema extensions;

create table if not exists public.rag_documents (
  id text primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  tier text not null,
  retrieval_priority integer not null default 0,
  source_url text,
  source_title text,
  source_domain text,
  source_kind text,
  source_quality text,
  last_checked date,
  embedding extensions.vector(768),
  fts tsvector generated always as (
    to_tsvector('english', coalesce(source_title, '') || ' ' || coalesce(content, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rag_documents_metadata_gin
  on public.rag_documents using gin (metadata);

create index if not exists rag_documents_tier_priority_idx
  on public.rag_documents (tier, retrieval_priority desc);

create index if not exists rag_documents_fts_idx
  on public.rag_documents using gin (fts);

create index if not exists rag_documents_embedding_hnsw
  on public.rag_documents using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.set_updated_at_rag_documents()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_rag_documents on public.rag_documents;
create trigger trg_set_updated_at_rag_documents
before update on public.rag_documents
for each row
execute function public.set_updated_at_rag_documents();

create or replace function public.search_rag_documents(
  query_text text,
  match_count integer default 6,
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
  source_domain text,
  source_kind text,
  source_quality text,
  last_checked date,
  text_score float
)
language sql
as $$
  select
    d.id,
    d.content,
    d.metadata,
    d.tier,
    d.retrieval_priority,
    d.source_url,
    d.source_title,
    d.source_domain,
    d.source_kind,
    d.source_quality,
    d.last_checked,
    ts_rank_cd(d.fts, websearch_to_tsquery('english', query_text)) as text_score
  from public.rag_documents d
  where d.fts @@ websearch_to_tsquery('english', query_text)
    and (filter = '{}'::jsonb or d.metadata @> filter)
  order by text_score desc, d.retrieval_priority desc
  limit least(match_count, 20);
$$;
