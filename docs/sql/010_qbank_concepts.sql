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
