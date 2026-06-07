create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(384) not null,
  metadata jsonb not null default '{}'::jsonb,
  source_title text,
  source_url text,
  source_kind text not null default 'past_paper',
  embedding_model text not null default 'sentence-transformers/all-MiniLM-L6-v2',
  content_hash text not null unique,
  fts tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(source_title, '') || ' ' || coalesce(content, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_embedding_hnsw_idx
  on public.documents using hnsw (embedding vector_cosine_ops);
create index if not exists documents_fts_idx
  on public.documents using gin (fts);
create index if not exists documents_metadata_idx
  on public.documents using gin (metadata);

alter table public.documents enable row level security;
drop policy if exists "Authenticated users can read documents" on public.documents;
create policy "Authenticated users can read documents"
  on public.documents for select
  to authenticated
  using (true);

create or replace function public.document_matches_filter(
  document_metadata jsonb,
  filter jsonb
)
returns boolean
language sql
immutable
as $$
  select
    (coalesce(filter->>'subject', '') = ''
      or lower(coalesce(document_metadata->>'subject', '')) = lower(filter->>'subject'))
    and
    (coalesce(filter->>'board', '') = ''
      or lower(coalesce(document_metadata->>'board', '')) = lower(filter->>'board'))
    and
    (coalesce(filter->>'level', '') = ''
      or lower(coalesce(document_metadata->>'level', '')) = lower(filter->>'level'))
    and
    (coalesce(filter->>'topic', '') = ''
      or lower(coalesce(document_metadata->>'topic', '')) like '%' || lower(filter->>'topic') || '%'
      or lower(coalesce(document_metadata->>'chapter', '')) like '%' || lower(filter->>'topic') || '%')
    and
    (coalesce(filter->>'year_from', '') = ''
      or (
        coalesce(document_metadata->>'year', '') ~ '^[0-9]{4}$'
        and (document_metadata->>'year')::integer >= (filter->>'year_from')::integer
      ))
    and
    (coalesce(filter->>'year_to', '') = ''
      or (
        coalesce(document_metadata->>'year', '') ~ '^[0-9]{4}$'
        and (document_metadata->>'year')::integer <= (filter->>'year_to')::integer
      ));
$$;

create or replace function public.hybrid_search_documents(
  query_embedding vector(384),
  query_text text,
  match_threshold double precision default 0.7,
  match_count integer default 5,
  filter jsonb default '{}'::jsonb
)
returns table (
  id text,
  content text,
  metadata jsonb,
  source_title text,
  source_url text,
  source_kind text,
  tier text,
  vector_similarity double precision,
  text_score double precision,
  hybrid_score double precision
)
language sql
stable
as $$
  with scored as (
    select
      d.*,
      1 - (d.embedding <=> query_embedding) as vector_similarity,
      case
        when nullif(trim(query_text), '') is null then 0::double precision
        else ts_rank_cd(d.fts, websearch_to_tsquery('english', query_text))::double precision
      end as text_score
    from public.documents d
    where d.embedding_model = 'sentence-transformers/all-MiniLM-L6-v2'
      and public.document_matches_filter(d.metadata, filter)
  )
  select
    scored.id::text,
    scored.content,
    scored.metadata,
    scored.source_title,
    scored.source_url,
    scored.source_kind,
    'past_paper'::text as tier,
    scored.vector_similarity,
    scored.text_score,
    (
      scored.vector_similarity * 0.8
      + least(scored.text_score, 1::double precision) * 0.2
    ) as hybrid_score
  from scored
  where scored.vector_similarity >= match_threshold
    or scored.text_score > 0
  order by hybrid_score desc
  limit least(greatest(match_count, 1), 5);
$$;

create or replace function public.match_documents(
  query_embedding vector(384),
  match_threshold double precision default 0.7,
  match_count integer default 5,
  filter jsonb default '{}'::jsonb,
  query_text text default ''
)
returns table (
  id text,
  content text,
  metadata jsonb,
  source_title text,
  source_url text,
  source_kind text,
  tier text,
  vector_similarity double precision,
  text_score double precision,
  hybrid_score double precision
)
language sql
stable
as $$
  with scored as (
    select
      d.*,
      1 - (d.embedding <=> query_embedding) as vector_similarity,
      case
        when nullif(trim(query_text), '') is null then 0::double precision
        else ts_rank_cd(d.fts, websearch_to_tsquery('english', query_text))::double precision
      end as text_score
    from public.documents d
    where d.embedding_model = 'sentence-transformers/all-MiniLM-L6-v2'
      and public.document_matches_filter(d.metadata, filter)
  )
  select
    scored.id::text,
    scored.content,
    scored.metadata,
    scored.source_title,
    scored.source_url,
    scored.source_kind,
    'past_paper'::text as tier,
    scored.vector_similarity,
    scored.text_score,
    (
      scored.vector_similarity * 0.82
      + least(scored.text_score, 1::double precision) * 0.18
    ) as hybrid_score
  from scored
  where scored.vector_similarity >= match_threshold
    or scored.text_score > 0
  order by hybrid_score desc
  limit least(greatest(match_count, 1), 5);
$$;

create or replace function public.search_documents_keyword(
  query_text text,
  match_count integer default 5,
  filter jsonb default '{}'::jsonb
)
returns table (
  id text,
  content text,
  metadata jsonb,
  source_title text,
  source_url text,
  source_kind text,
  tier text,
  vector_similarity double precision,
  text_score double precision,
  hybrid_score double precision
)
language sql
stable
as $$
  select
    d.id::text,
    d.content,
    d.metadata,
    d.source_title,
    d.source_url,
    d.source_kind,
    'past_paper'::text as tier,
    null::double precision,
    ts_rank_cd(d.fts, websearch_to_tsquery('english', query_text))::double precision,
    ts_rank_cd(d.fts, websearch_to_tsquery('english', query_text))::double precision
  from public.documents d
  where nullif(trim(query_text), '') is not null
    and d.fts @@ websearch_to_tsquery('english', query_text)
    and public.document_matches_filter(d.metadata, filter)
  order by text_score desc
  limit least(greatest(match_count, 1), 5);
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists setup_completed boolean not null default false;

alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'solver',
  user_message text not null,
  assistant_message text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
drop policy if exists "Users can read own conversations" on public.conversations;
create policy "Users can read own conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can insert own conversations" on public.conversations;
create policy "Users can insert own conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user_id);
