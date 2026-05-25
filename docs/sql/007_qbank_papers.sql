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
