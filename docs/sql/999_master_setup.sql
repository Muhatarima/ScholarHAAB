-- ======= FILE: 001_daily_usage.sql =======
create table if not exists public.daily_usage (
  id bigserial primary key,
  viewer_key text not null,
  usage_date date not null default current_date,
  tier text not null default 'trial',
  credits_used integer not null default 0,
  actions_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viewer_key, usage_date)
);

create index if not exists daily_usage_viewer_key_idx on public.daily_usage (viewer_key);
create index if not exists daily_usage_usage_date_idx on public.daily_usage (usage_date);


-- ======= FILE: 002_chat_history.sql =======
create table if not exists public.chat_sessions (
  id text primary key,
  viewer_key text not null,
  product text not null check (product in ('abroad', 'qbank')),
  mode text not null check (mode in ('direct', 'tutor')),
  title text not null,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_viewer_product_updated_idx
  on public.chat_sessions (viewer_key, product, updated_at desc);

create table if not exists public.chat_messages (
  id text primary key,
  session_id text not null references public.chat_sessions(id) on delete cascade,
  viewer_key text not null,
  product text not null check (product in ('abroad', 'qbank')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sequence_no integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_messages_session_sequence_idx
  on public.chat_messages (session_id, sequence_no);

create index if not exists chat_messages_viewer_product_created_idx
  on public.chat_messages (viewer_key, product, created_at desc);

create or replace function public.set_updated_at_chat_sessions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ======= FILE: 020_llm_usage.sql =======
create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  call_count integer not null default 0,
  estimated_cost_usd double precision not null default 0,
  unique (date, provider, model)
);

create index if not exists idx_llm_usage_date
  on public.llm_usage (date desc);

create or replace function public.increment_llm_usage(
  p_date date,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost double precision
)
returns void
language plpgsql
as $$
begin
  insert into public.llm_usage (
    date,
    provider,
    model,
    input_tokens,
    output_tokens,
    call_count,
    estimated_cost_usd
  )
  values (
    p_date,
    p_provider,
    p_model,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    1,
    greatest(coalesce(p_cost, 0), 0)
  )
  on conflict (date, provider, model) do update
  set
    input_tokens = public.llm_usage.input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
    output_tokens = public.llm_usage.output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
    call_count = public.llm_usage.call_count + 1,
    estimated_cost_usd = public.llm_usage.estimated_cost_usd + greatest(coalesce(p_cost, 0), 0);
end;
$$;


-- ======= FILE: 021_answer_cache.sql =======
create table if not exists public.answer_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null unique,
  query_text text not null,
  intent text,
  board text,
  subject text,
  response text not null,
  sources jsonb not null default '[]'::jsonb,
  confidence integer,
  hit_count integer not null default 1,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists idx_cache_hash on public.answer_cache(query_hash);
create index if not exists idx_cache_expires on public.answer_cache(expires_at);
create index if not exists idx_cache_hits on public.answer_cache(hit_count desc);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'cached_answers'
  ) then
    insert into public.answer_cache (
      query_hash,
      query_text,
      response,
      sources,
      confidence,
      hit_count,
      created_at,
      last_hit_at,
      expires_at
    )
    select
      question_hash,
      question_text,
      answer,
      coalesce(sources_json, '[]'::jsonb),
      null,
      greatest(coalesce(hit_count, 0), 1),
      coalesce(created_at, now()),
      coalesce(created_at, now()),
      coalesce(expires_at, now() + interval '7 days')
    from public.cached_answers
    on conflict (query_hash) do nothing;
  end if;
end;
$$;

create or replace function public.increment_answer_cache_hit(p_query_hash text)
returns void
language plpgsql
as $$
begin
  update public.answer_cache
  set
    hit_count = hit_count + 1,
    last_hit_at = now()
  where query_hash = p_query_hash;
end;
$$;

create or replace function public.get_answer_cache_stats()
returns table (
  total_entries bigint,
  total_hits bigint,
  avg_hits_per_entry numeric,
  hot_entries bigint,
  hits_today bigint
)
language sql
as $$
  select
    count(*) as total_entries,
    coalesce(sum(hit_count), 0) as total_hits,
    coalesce(avg(hit_count::numeric), 0) as avg_hits_per_entry,
    count(*) filter (where hit_count > 5) as hot_entries,
    coalesce(sum(hit_count) filter (where created_at > now() - interval '24 hours'), 0) as hits_today
  from public.answer_cache;
$$;

create or replace function public.purge_expired_answer_cache()
returns integer
language plpgsql
as $$
declare
  deleted_count integer;
begin
  delete from public.answer_cache
  where expires_at < now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

drop trigger if exists trg_set_updated_at_chat_sessions on public.chat_sessions;
create trigger trg_set_updated_at_chat_sessions
before update on public.chat_sessions
for each row
execute function public.set_updated_at_chat_sessions();


-- ======= FILE: 003_identity_and_subscriptions.sql =======
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  default_product text check (default_product in ('abroad', 'qbank')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('trial', 'pro', 'premium')),
  status text not null check (status in ('trialing', 'active', 'canceled', 'past_due', 'expired')),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, updated_at desc);

create unique index if not exists subscriptions_provider_unique
  on public.subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create or replace function public.set_updated_at_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_profiles on public.profiles;
create trigger trg_set_updated_at_profiles
before update on public.profiles
for each row
execute function public.set_updated_at_profiles();

create or replace function public.set_updated_at_subscriptions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_subscriptions on public.subscriptions;
create trigger trg_set_updated_at_subscriptions
before update on public.subscriptions
for each row
execute function public.set_updated_at_subscriptions();


-- ======= FILE: 004_rag_documents.sql =======
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


-- ======= FILE: 005_qbank_core.sql =======
create table if not exists public.qbank_topic_map (
  id text primary key,
  board text not null,
  level text not null,
  subject text not null,
  chapter text not null,
  topic text not null,
  importance_score integer not null default 50,
  repeat_years text[] not null default '{}',
  exam_tips text[] not null default '{}',
  summary text not null,
  search_text text not null,
  source_label text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('english', coalesce(board, '') || ' ' ||
      coalesce(level, '') || ' ' ||
      coalesce(subject, '') || ' ' ||
      coalesce(chapter, '') || ' ' ||
      coalesce(topic, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(search_text, '')
    )
  ) stored
);

create table if not exists public.qbank_questions (
  id text primary key,
  board text not null,
  level text not null,
  subject text not null,
  year integer,
  paper text,
  question_label text,
  chapter text not null,
  topic text not null,
  question_text text not null,
  answer_summary text not null,
  method_steps text[] not null default '{}',
  repeat_signal text,
  source_label text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('english', coalesce(board, '') || ' ' ||
      coalesce(level, '') || ' ' ||
      coalesce(subject, '') || ' ' ||
      coalesce(chapter, '') || ' ' ||
      coalesce(topic, '') || ' ' ||
      coalesce(question_text, '') || ' ' ||
      coalesce(answer_summary, '')
    )
  ) stored
);

create index if not exists qbank_topic_map_subject_idx
  on public.qbank_topic_map (board, level, subject, importance_score desc);

create index if not exists qbank_topic_map_fts_idx
  on public.qbank_topic_map using gin (fts);

create index if not exists qbank_questions_subject_idx
  on public.qbank_questions (board, level, subject, year desc);

create index if not exists qbank_questions_fts_idx
  on public.qbank_questions using gin (fts);

create or replace function public.set_updated_at_qbank_topic_map()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_qbank_topic_map on public.qbank_topic_map;
create trigger trg_set_updated_at_qbank_topic_map
before update on public.qbank_topic_map
for each row
execute function public.set_updated_at_qbank_topic_map();

create or replace function public.set_updated_at_qbank_questions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_qbank_questions on public.qbank_questions;
create trigger trg_set_updated_at_qbank_questions
before update on public.qbank_questions
for each row
execute function public.set_updated_at_qbank_questions();


-- ======= FILE: 006_qbank_sources.sql =======
create table if not exists public.qbank_sources (
  id text primary key,
  provider text not null,
  source_kind text not null,
  board text not null,
  level text not null,
  subject text not null,
  title text not null,
  url text not null,
  quality_tier text not null,
  allowed_use text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(provider, '') || ' ' ||
      coalesce(source_kind, '') || ' ' ||
      coalesce(board, '') || ' ' ||
      coalesce(level, '') || ' ' ||
      coalesce(subject, '') || ' ' ||
      coalesce(title, '')
    )
  ) stored
);

create index if not exists qbank_sources_fts_idx
  on public.qbank_sources using gin (fts);

create index if not exists qbank_sources_board_level_subject_idx
  on public.qbank_sources (board, level, subject);


-- ======= FILE: 007_qbank_papers.sql =======
create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text language sql immutable as $$
  select array_to_string(arr, sep);
$$;

create table if not exists public.qbank_papers (
  id text primary key,
  board text not null,
  level text not null,
  subject text not null,
  year integer,
  paper text not null,
  paper_code text,
  paper_title text not null,
  session text,
  focus_topics text[] not null default '{}',
  source_label text,
  source_url text,
  quality_tier text not null default 'tier2_internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('english', coalesce(board, '') || ' ' ||
      coalesce(level, '') || ' ' ||
      coalesce(subject, '') || ' ' ||
      coalesce(paper, '') || ' ' ||
      coalesce(paper_code, '') || ' ' ||
      coalesce(paper_title, '') || ' ' ||
      coalesce(session, '') || ' ' ||
      public.immutable_array_to_string(focus_topics, ' ')
    )
  ) stored
);

create index if not exists qbank_papers_lookup_idx
  on public.qbank_papers (board, level, subject, year desc);

create index if not exists qbank_papers_fts_idx
  on public.qbank_papers using gin (fts);

create or replace function public.set_updated_at_qbank_papers()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_qbank_papers on public.qbank_papers;
create trigger trg_set_updated_at_qbank_papers
before update on public.qbank_papers
for each row
execute function public.set_updated_at_qbank_papers();


-- ======= FILE: 008_chat_message_sources.sql =======
alter table public.chat_messages
add column if not exists sources jsonb;


-- ======= FILE: 009_abroad_knowledge_tables.sql =======
create table if not exists public.abroad_scholarships (
  id text primary key,
  title text not null,
  provider text,
  jurisdiction text,
  degree_levels jsonb not null default '[]'::jsonb,
  fields_of_study jsonb not null default '[]'::jsonb,
  funding_type text,
  funding_amount_text text,
  deadline_annual text,
  deadline_notes text,
  official_url text,
  last_checked text,
  authenticity_status text,
  live_answer_mode text,
  caution text,
  search_text text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(search_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abroad_scholarships_fts_idx
  on public.abroad_scholarships using gin (fts);

create index if not exists abroad_scholarships_country_idx
  on public.abroad_scholarships (jurisdiction);

create table if not exists public.abroad_guidance (
  id text primary key,
  record_type text not null,
  jurisdiction text not null,
  topic text not null,
  title text not null,
  content text not null,
  source_url text,
  source_kind text not null,
  last_checked text,
  tags jsonb not null default '[]'::jsonb,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abroad_guidance_fts_idx
  on public.abroad_guidance using gin (fts);

create index if not exists abroad_guidance_jurisdiction_idx
  on public.abroad_guidance (jurisdiction);

create table if not exists public.abroad_document_cases (
  id text primary key,
  rubric_type text not null,
  quality_band text,
  input_text text not null,
  output_text text not null,
  tags jsonb not null default '[]'::jsonb,
  search_text text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abroad_document_cases_fts_idx
  on public.abroad_document_cases using gin (fts);

create or replace function public.set_updated_at_abroad_knowledge()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_abroad_scholarships on public.abroad_scholarships;
create trigger trg_set_updated_at_abroad_scholarships
before update on public.abroad_scholarships
for each row
execute function public.set_updated_at_abroad_knowledge();

drop trigger if exists trg_set_updated_at_abroad_guidance on public.abroad_guidance;
create trigger trg_set_updated_at_abroad_guidance
before update on public.abroad_guidance
for each row
execute function public.set_updated_at_abroad_knowledge();

drop trigger if exists trg_set_updated_at_abroad_document_cases on public.abroad_document_cases;
create trigger trg_set_updated_at_abroad_document_cases
before update on public.abroad_document_cases
for each row
execute function public.set_updated_at_abroad_knowledge();


-- ======= FILE: 010_qbank_concepts.sql =======
create table if not exists public.qbank_concepts (
  id text primary key,
  board text not null,
  level text not null,
  subject text not null,
  chapter text not null,
  topic text not null,
  concept_summary text not null,
  exam_tips jsonb not null default '[]'::jsonb,
  repeat_years jsonb not null default '[]'::jsonb,
  formula_candidates jsonb not null default '[]'::jsonb,
  question_examples jsonb not null default '[]'::jsonb,
  answer_patterns jsonb not null default '[]'::jsonb,
  importance_score integer not null default 0,
  source_urls jsonb not null default '[]'::jsonb,
  source_labels jsonb not null default '[]'::jsonb,
  search_text text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(board, '') || ' ' || coalesce(level, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(chapter, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(search_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qbank_concepts_fts_idx
  on public.qbank_concepts using gin (fts);

create index if not exists qbank_concepts_subject_idx
  on public.qbank_concepts (subject, board, level);

create or replace function public.set_updated_at_qbank_concepts()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_qbank_concepts on public.qbank_concepts;
create trigger trg_set_updated_at_qbank_concepts
before update on public.qbank_concepts
for each row
execute function public.set_updated_at_qbank_concepts();


-- ======= FILE: 011_high_security_rls_and_limits.sql =======
-- 1. Create the user_devices table for tracking the 3-device limit
create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  viewer_key text not null,
  last_active timestamptz not null default now(),
  primary key (user_id, viewer_key)
);

create index if not exists user_devices_user_id_idx on public.user_devices(user_id);

-- 2. RPC function to securely register or reject a device
create or replace function public.register_user_device(p_user_id uuid, p_viewer_key text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_device_count int;
  v_device_exists boolean;
begin
  -- Check if device is already registered
  select exists(
    select 1 from public.user_devices 
    where user_id = p_user_id and viewer_key = p_viewer_key
  ) into v_device_exists;

  if v_device_exists then
    update public.user_devices 
    set last_active = now() 
    where user_id = p_user_id and viewer_key = p_viewer_key;
    return true;
  end if;

  -- Count existing devices
  select count(*) into v_device_count 
  from public.user_devices 
  where user_id = p_user_id;

  if v_device_count >= 3 then
    return false; -- Reached the 3 device limit, absolutely no more allowed.
  end if;

  -- Insert new device securely
  insert into public.user_devices (user_id, viewer_key) 
  values (p_user_id, p_viewer_key);
  
  return true;
end;
$$;

-- 3. RPC function to prevent usage limit cheating via atomic lock
create or replace function public.commit_usage_atomic(
  p_viewer_key text,
  p_usage_date text,
  p_tier text,
  p_cost integer,
  p_daily_limit integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_used integer;
begin
  -- Attempt to lock the row securely
  select credits_used into v_used 
  from public.daily_usage 
  where viewer_key = p_viewer_key and usage_date = p_usage_date::date
  for update;

  if not found then
    -- Doesn't exist, insert if under limit
    if p_cost > p_daily_limit then
      raise exception 'Daily limit reached';
    end if;

    insert into public.daily_usage (viewer_key, usage_date, tier, credits_used, actions_count)
    values (p_viewer_key, p_usage_date::date, p_tier, p_cost, 1);
    
    return p_cost;
  end if;

  if (v_used + p_cost) > p_daily_limit then
    raise exception 'Daily limit reached';
  end if;

  update public.daily_usage 
  set 
    credits_used = credits_used + p_cost,
    actions_count = actions_count + 1,
    tier = p_tier,
    updated_at = now()
  where viewer_key = p_viewer_key and usage_date = p_usage_date::date;

  return v_used + p_cost;
end;
$$;

-- 4. Secure all database tables directly by overriding with Row Level Security defaulting to "Deny All"
DO $$ 
DECLARE 
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;


-- ======= FILE: 012_feedback_table.sql =======
-- 1. Create the feedback database table
CREATE TABLE IF NOT EXISTS public.feedback (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  rating      TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  reviewed    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. Secure it using the standard Default Deny RLS principle
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 3. (Optional) Create policy for authenticated users if clientside writes are needed,
-- but since our \`app/api/feedback/route.ts\` uses the admin key serverside,
-- leaving it entirely locked down from the browser default is safest!


-- ======= FILE: 013_add_dob_and_profile_trigger.sql =======
-- 1. Add date_of_birth to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 2. Create an automated trigger so that when someone signs up,
-- their Auth metadata (Full Name, Date of Birth) is instantly mirrored 
-- into the secure public.profiles table so it can be queried safely via Next.js.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, date_of_birth, created_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    CAST(NEW.raw_user_meta_data->>'date_of_birth' AS DATE),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to Supabase Auth user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Ensure RLS maintains its lockdown on this modified table format.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ======= FILE: 014_cached_answers.sql =======
create table if not exists public.cached_answers (
  id bigserial primary key,
  question_hash text not null unique,
  question_text text not null,
  answer text not null,
  product text not null,
  mode text not null default 'direct',
  sources_json jsonb not null default '[]'::jsonb,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists cached_answers_product_idx on public.cached_answers(product);
create index if not exists cached_answers_expires_idx on public.cached_answers(expires_at);


-- ======= FILE: 015_payment_logs.sql =======
create table if not exists public.payment_logs (
  id bigserial primary key,
  tran_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  amount integer not null,
  status text not null default 'pending',
  val_id text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_logs_user_id_idx on public.payment_logs(user_id);
create index if not exists payment_logs_status_idx on public.payment_logs(status);


-- ======= FILE: 016_qa_feedback.sql =======
create table if not exists public.qa_feedback (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  response text not null,
  category text,
  issue_type text,
  auto_score integer,
  user_flagged boolean default false,
  created_at timestamptz default now(),
  fixed boolean default false,
  issues_json jsonb not null default '[]'::jsonb,
  response_time_ms integer,
  metadata_json jsonb not null default '{}'::jsonb
);

alter table public.qa_feedback enable row level security;

create index if not exists qa_feedback_created_idx
  on public.qa_feedback(created_at desc);

create index if not exists qa_feedback_flagged_idx
  on public.qa_feedback(user_flagged, fixed, created_at desc);

create index if not exists qa_feedback_auto_score_idx
  on public.qa_feedback(auto_score, created_at desc);


-- ======= FILE: 018_launch_blockers.sql =======
alter table public.profiles
  add column if not exists email text,
  add column if not exists preferred_board text,
  add column if not exists preferred_level text,
  add column if not exists preferred_subjects text[] not null default '{}',
  add column if not exists preferred_language text not null default 'en',
  add column if not exists target_country text,
  add column if not exists target_degree text,
  add column if not exists target_field text,
  add column if not exists funding_preference text,
  add column if not exists nationality text not null default 'Bangladesh',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists wants_deadline_alerts boolean not null default true;

update public.profiles
set nationality = coalesce(nullif(nationality, ''), 'Bangladesh');

create table if not exists public.scholarship_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_name text not null,
  country text,
  degree text,
  funding text,
  deadline text,
  link text,
  match_reason text,
  notify_before_days integer not null default 30,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scholarship_alerts_user_name_unique
  on public.scholarship_alerts(user_id, scholarship_name);

create index if not exists scholarship_alerts_user_created_idx
  on public.scholarship_alerts(user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    date_of_birth,
    nationality,
    onboarding_completed,
    wants_deadline_alerts,
    created_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    cast(new.raw_user_meta_data->>'date_of_birth' as date),
    coalesce(new.raw_user_meta_data->>'nationality', 'Bangladesh'),
    false,
    true,
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    date_of_birth = coalesce(excluded.date_of_birth, public.profiles.date_of_birth);

  return new;
end;
$$;

create or replace function public.set_updated_at_scholarship_alerts()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_scholarship_alerts on public.scholarship_alerts;
create trigger trg_set_updated_at_scholarship_alerts
before update on public.scholarship_alerts
for each row
execute function public.set_updated_at_scholarship_alerts();


-- ======= FILE: 019_study_progress.sql =======
alter table public.profiles
  add column if not exists streak_days integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists total_xp integer not null default 0,
  add column if not exists last_active_date date;

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  messages_count integer not null default 0,
  qbank_messages integer not null default 0,
  abroad_messages integer not null default 0,
  xp_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, activity_date)
);

create index if not exists daily_activity_user_date_idx
  on public.daily_activity (user_id, activity_date desc);

create or replace function public.set_updated_at_daily_activity()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_daily_activity on public.daily_activity;
create trigger trg_set_updated_at_daily_activity
before update on public.daily_activity
for each row
execute function public.set_updated_at_daily_activity();

create or replace function public.record_study_activity(
  p_user_id uuid,
  p_activity_date date,
  p_product text,
  p_base_xp integer,
  p_attachment_bonus integer default 0,
  p_message_count integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_today_exists boolean;
  v_previous_active date;
  v_previous_streak integer;
  v_new_streak integer;
  v_xp_gain integer;
begin
  insert into public.profiles (
    id,
    nationality,
    onboarding_completed,
    wants_deadline_alerts,
    streak_days,
    longest_streak,
    total_xp,
    last_active_date
  )
  values (
    p_user_id,
    'Bangladesh',
    false,
    true,
    0,
    0,
    0,
    null
  )
  on conflict (id) do nothing;

  select exists(
    select 1
    from public.daily_activity
    where user_id = p_user_id
      and activity_date = p_activity_date
  ) into v_today_exists;

  v_xp_gain := greatest(coalesce(p_base_xp, 0), 0) + greatest(coalesce(p_attachment_bonus, 0), 0);
  if not v_today_exists then
    v_xp_gain := v_xp_gain + 20;
  end if;

  insert into public.daily_activity (
    user_id,
    activity_date,
    messages_count,
    qbank_messages,
    abroad_messages,
    xp_earned
  )
  values (
    p_user_id,
    p_activity_date,
    greatest(coalesce(p_message_count, 1), 1),
    case when p_product = 'qbank' then greatest(coalesce(p_message_count, 1), 1) else 0 end,
    case when p_product = 'abroad' then greatest(coalesce(p_message_count, 1), 1) else 0 end,
    v_xp_gain
  )
  on conflict (user_id, activity_date) do update
  set
    messages_count = public.daily_activity.messages_count + excluded.messages_count,
    qbank_messages = public.daily_activity.qbank_messages + excluded.qbank_messages,
    abroad_messages = public.daily_activity.abroad_messages + excluded.abroad_messages,
    xp_earned = public.daily_activity.xp_earned + excluded.xp_earned,
    updated_at = now();

  select
    last_active_date,
    coalesce(streak_days, 0)
  into
    v_previous_active,
    v_previous_streak
  from public.profiles
  where id = p_user_id
  for update;

  if v_previous_active is null then
    v_new_streak := 1;
  elsif v_previous_active = p_activity_date then
    v_new_streak := greatest(v_previous_streak, 1);
  elsif v_previous_active = (p_activity_date - interval '1 day')::date then
    v_new_streak := v_previous_streak + 1;
  else
    v_new_streak := 1;
  end if;

  update public.profiles
  set
    total_xp = greatest(coalesce(total_xp, 0), 0) + v_xp_gain,
    last_active_date = greatest(coalesce(last_active_date, p_activity_date), p_activity_date),
    streak_days = case
      when last_active_date = p_activity_date then greatest(coalesce(streak_days, 0), 1)
      else v_new_streak
    end,
    longest_streak = greatest(
      coalesce(longest_streak, 0),
      case
        when last_active_date = p_activity_date then greatest(coalesce(streak_days, 0), 1)
        else v_new_streak
      end
    ),
    updated_at = now()
  where id = p_user_id;
end;
$$;
