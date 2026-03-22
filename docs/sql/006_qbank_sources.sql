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
    to_tsvector(
      'english',
      coalesce(provider, '') || ' ' ||
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
