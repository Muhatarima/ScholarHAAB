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
