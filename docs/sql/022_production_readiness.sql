create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists email text,
  add column if not exists wants_deadline_alerts boolean not null default true,
  add column if not exists credits_left integer not null default 12;

create table if not exists public.scholarship_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_name text not null,
  country text,
  degree text,
  funding text,
  deadline text,
  link text,
  match_reason text,
  notify_before_days integer not null default 30,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scholarship_alerts_user_name_unique
  on public.scholarship_alerts (user_id, scholarship_name);

create index if not exists scholarship_alerts_user_created_idx
  on public.scholarship_alerts (user_id, created_at desc);

create or replace function public.set_updated_at_scholarship_alerts()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_scholarship_alerts on public.scholarship_alerts;
create trigger trg_set_updated_at_scholarship_alerts
before update on public.scholarship_alerts
for each row
execute function public.set_updated_at_scholarship_alerts();

create or replace view public.user_profiles as
select *
from public.profiles;

create or replace view public.scholarships as
select
  id,
  title,
  provider,
  jurisdiction,
  degree_levels,
  fields_of_study,
  funding_type,
  funding_amount_text,
  deadline_annual,
  deadline_notes,
  official_url,
  last_checked,
  authenticity_status,
  live_answer_mode,
  caution,
  search_text,
  created_at,
  updated_at
from public.abroad_scholarships;

alter table public.answer_cache enable row level security;
alter table public.llm_usage enable row level security;
alter table public.qa_feedback enable row level security;
alter table public.rate_limit_log enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.scholarship_alerts enable row level security;

drop policy if exists service_only_cache on public.answer_cache;
create policy service_only_cache
on public.answer_cache
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_only_usage on public.llm_usage;
create policy service_only_usage
on public.llm_usage
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_only_qa on public.qa_feedback;
create policy service_only_qa
on public.qa_feedback
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_only_rate on public.rate_limit_log;
create policy service_only_rate
on public.rate_limit_log
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists users_read_own_ledger on public.credit_ledger;
create policy users_read_own_ledger
on public.credit_ledger
for select
using (auth.uid() = user_id);

drop policy if exists service_write_ledger on public.credit_ledger;
create policy service_write_ledger
on public.credit_ledger
for insert
with check (auth.role() = 'service_role');

drop policy if exists service_update_ledger on public.credit_ledger;
create policy service_update_ledger
on public.credit_ledger
for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_only_scholarship_alerts on public.scholarship_alerts;
create policy service_only_scholarship_alerts
on public.scholarship_alerts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
