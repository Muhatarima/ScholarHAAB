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
