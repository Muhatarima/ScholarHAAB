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
    to_tsvector(
      'english',
      coalesce(board, '') || ' ' ||
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
    to_tsvector(
      'english',
      coalesce(board, '') || ' ' ||
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
