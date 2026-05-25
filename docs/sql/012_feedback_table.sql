create table if not exists public.feedback (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  product text,
  mode text,
  question text not null,
  answer text not null,
  rating text not null check (rating in ('thumbs_up', 'thumbs_down')),
  note text,
  sources_json jsonb not null default '[]'::jsonb,
  reviewed boolean default false,
  improvement_status text not null default 'new',
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

create index if not exists feedback_user_created_idx on public.feedback(user_id, created_at desc);
create index if not exists feedback_status_idx on public.feedback(improvement_status, created_at desc);

create table if not exists public.model_improvement_queue (
  id bigserial primary key,
  feedback_id bigint references public.feedback(id) on delete cascade,
  product text not null,
  issue_type text not null,
  priority text not null default 'medium',
  status text not null default 'queued',
  prompt_input text not null,
  bad_answer text not null,
  target_behavior text not null,
  suggested_fix text,
  export_ready boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.model_improvement_queue enable row level security;

create index if not exists model_improvement_queue_status_idx
  on public.model_improvement_queue(status, export_ready, created_at desc);
