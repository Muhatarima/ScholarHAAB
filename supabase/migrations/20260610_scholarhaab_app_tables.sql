create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  question text,
  answer text,
  created_at timestamptz default now()
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  topic text,
  correct_count integer default 0,
  incorrect_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.generated_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject text,
  topic text,
  question text,
  answer text,
  created_at timestamptz default now()
);

create index if not exists conversations_user_created_idx
  on public.conversations (user_id, created_at desc);

create index if not exists user_progress_user_topic_idx
  on public.user_progress (user_id, topic);

create index if not exists generated_questions_user_created_idx
  on public.generated_questions (user_id, created_at desc);

create index if not exists generated_questions_subject_topic_idx
  on public.generated_questions (subject, topic);

alter table public.conversations enable row level security;
alter table public.user_progress enable row level security;
alter table public.generated_questions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'conversations_select_own') then
    create policy conversations_select_own on public.conversations
      for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'conversations_insert_own') then
    create policy conversations_insert_own on public.conversations
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_progress' and policyname = 'user_progress_select_own') then
    create policy user_progress_select_own on public.user_progress
      for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_progress' and policyname = 'user_progress_write_own') then
    create policy user_progress_write_own on public.user_progress
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'generated_questions' and policyname = 'generated_questions_select_own') then
    create policy generated_questions_select_own on public.generated_questions
      for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'generated_questions' and policyname = 'generated_questions_insert_own') then
    create policy generated_questions_insert_own on public.generated_questions
      for insert with check (auth.uid() = user_id);
  end if;
end
$$;
