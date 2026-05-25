-- ScholarHAAB adaptive learning system
-- Run this in Supabase SQL Editor before enabling live memory writes.

create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  level text,
  subjects jsonb default '[]'::jsonb,
  weak_topics jsonb default '[]'::jsonb,
  strong_topics jsonb default '[]'::jsonb,
  skipped_chapters jsonb default '[]'::jsonb,
  study_streak integer default 0,
  total_questions_attempted integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.student_profiles(id) on delete cascade,
  subject text,
  topic text,
  session_type text,
  questions_attempted integer default 0,
  questions_correct integer default 0,
  weak_points_identified jsonb default '[]'::jsonb,
  ai_notes text,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.student_profiles(id) on delete cascade,
  question_id text,
  subject text,
  topic text,
  subtopic text,
  difficulty text,
  student_answer text,
  is_correct boolean,
  marks_obtained integer,
  marks_available integer,
  time_taken_seconds integer,
  attempt_number integer default 1,
  mistake_type text,
  paper_type text,
  ai_feedback text,
  attempted_at timestamptz default now()
);

alter table public.question_attempts
  add column if not exists subtopic text,
  add column if not exists difficulty text,
  add column if not exists marks_available integer,
  add column if not exists mistake_type text,
  add column if not exists paper_type text;

create table if not exists public.ai_mock_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.student_profiles(id) on delete cascade,
  subject text,
  topic text,
  difficulty text,
  question_text text,
  mark_scheme text,
  marks integer,
  based_on_question_ids jsonb default '[]'::jsonb,
  generated_at timestamptz default now()
);

create table if not exists public.exam_predictions (
  id uuid primary key default gen_random_uuid(),
  subject text,
  level text,
  paper text,
  predicted_topics jsonb,
  confidence_score float,
  based_on_years jsonb,
  created_at timestamptz default now()
);

create table if not exists public.daily_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.student_profiles(id) on delete cascade,
  date date default current_date,
  subject text,
  questions_done integer default 0,
  correct_percentage float default 0,
  time_studied_minutes integer default 0,
  topics_covered jsonb default '[]'::jsonb,
  streak_maintained boolean default false
);

create unique index if not exists daily_progress_student_date_subject_idx
  on public.daily_progress (student_id, date, subject);

alter table public.student_profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.ai_mock_questions enable row level security;
alter table public.exam_predictions enable row level security;
alter table public.daily_progress enable row level security;

create policy if not exists "students read own learning profile"
  on public.student_profiles for select
  using (auth.uid() = id);

create policy if not exists "students update own learning profile"
  on public.student_profiles for update
  using (auth.uid() = id);

create policy if not exists "students read own sessions"
  on public.study_sessions for select
  using (auth.uid() = student_id);

create policy if not exists "students read own attempts"
  on public.question_attempts for select
  using (auth.uid() = student_id);

create policy if not exists "students read own mocks"
  on public.ai_mock_questions for select
  using (auth.uid() = student_id);

create policy if not exists "students read own daily progress"
  on public.daily_progress for select
  using (auth.uid() = student_id);

create policy if not exists "students read exam predictions"
  on public.exam_predictions for select
  using (true);

create or replace function public.handle_new_student_profile()
returns trigger as $$
begin
  insert into public.student_profiles (id, name, level, subjects)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    null,
    '[]'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_student_profile on auth.users;
create trigger on_auth_user_created_student_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_student_profile();
