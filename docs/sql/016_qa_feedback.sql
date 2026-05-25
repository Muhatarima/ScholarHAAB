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
